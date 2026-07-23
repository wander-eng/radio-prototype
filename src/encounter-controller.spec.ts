import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UIManager } from './hud';
import { EncounterController } from './encounter-controller';
import { createImpactActionIdSource, type ImpactEvent } from './impact-event';
import { Player } from './player';

function createElementStub() {
    return {
        className: '',
        style: { display: '', width: '', transform: '' },
        appendChild: vi.fn()
    };
}

function createPlayer() {
    const hud = {
        updatePlayerHP: vi.fn(),
        updateCombo: vi.fn(),
        setStation: vi.fn(),
        showPopup: vi.fn()
    } as unknown as UIManager;
    return new Player(hud, vi.fn());
}

describe('EncounterController reset', () => {
    beforeEach(() => {
        vi.stubGlobal('document', {
            createElement: vi.fn(createElementStub),
            body: { appendChild: vi.fn() }
        });
        vi.stubGlobal('window', { innerWidth: 1280, innerHeight: 720 });
    });

    it('restaura inimigos, cancela telegraphs, limpa projeteis e libera o token', () => {
        const scene = new THREE.Scene();
        const player = createPlayer();
        const encounter = new EncounterController(scene, player);
        const camera = new THREE.PerspectiveCamera();

        encounter.setEnemyPosition('melee_0', 0, 1, 4);
        encounter.update(0, camera);
        expect(encounter.snapshot().meleeAttackOwnerId).toBe('melee_0');
        expect(encounter.melees[0].telegraphActive).toBe(true);

        encounter.melees[1].receiveHit(new THREE.Vector3(), 50);
        encounter.melees[1].update(0.3, player, camera);
        expect(encounter.melees[1].meleeState).toBe('dead');
        encounter.ranged.receiveHit(new THREE.Vector3(), 20);
        encounter.setEnemyPosition('ranged_0', 0, 1, -4);
        encounter.ranged.update(0, player, camera);
        expect(encounter.ranged.telegraphActive).toBe(true);
        encounter.setEnemyPosition('melee_0', 8, 1, 8);
        encounter.spawnProjectile(new THREE.Vector3(), new THREE.Vector3(1, 0, 0));
        expect(encounter.snapshot().projectiles).toHaveLength(1);

        encounter.reset();
        const snapshot = encounter.snapshot();
        expect(snapshot.meleeAttackOwnerId).toBeNull();
        expect(snapshot.projectiles).toHaveLength(0);
        expect(snapshot.enemies).toMatchObject([
            { id: 'melee_0', hp: 50, state: 'chase', x: -3, y: 1, z: -3, telegraphActive: false },
            { id: 'melee_1', hp: 50, state: 'chase', x: 3, y: 1, z: -3, telegraphActive: false },
            { id: 'ranged_0', hp: 40, state: 'reposition', x: 0, y: 1, z: -8, telegraphActive: false }
        ]);
    });

    it('e idempotente e preserva o respawn individual fora do reset completo', () => {
        const encounter = new EncounterController(new THREE.Scene(), createPlayer());
        const camera = new THREE.PerspectiveCamera();
        encounter.reset();
        encounter.reset();
        expect(encounter.snapshot().projectiles).toHaveLength(0);
        expect(encounter.snapshot().meleeAttackOwnerId).toBeNull();

        const melee = encounter.melees[0];
        melee.receiveHit(new THREE.Vector3(), 50);
        melee.update(0.3, createPlayer(), camera);
        melee.update(2.7, createPlayer(), camera);
        expect(melee.state).toBe('active');
        expect(melee.meleeState).toBe('chase');
        expect(melee.hp).toBe(50);
        expect(melee.mesh.position.toArray()).toEqual([-3, 1, -3]);
    });

    it('nao atualiza inimigos nem projeteis enquanto o jogador esta morto', () => {
        const player = createPlayer();
        const encounter = new EncounterController(new THREE.Scene(), player);
        const camera = new THREE.PerspectiveCamera();
        encounter.spawnProjectile(new THREE.Vector3(10, 10, 10), player.mesh.position);
        const beforeDeath = encounter.snapshot();

        player.receiveAttack(100);
        encounter.update(5, camera);

        expect(encounter.snapshot()).toEqual(beforeDeath);
        expect(player.isDead).toBe(true);
    });

    it('forwards one accepted melee result and ignores the next global-invulnerability result', () => {
        const player = createPlayer();
        const events: ImpactEvent[] = [];
        const encounter = new EncounterController(new THREE.Scene(), player, {
            nextActionId: createImpactActionIdSource(100),
            emit: (event) => events.push(event),
            getContext: () => ({ station: 'phonk', transformed: true })
        });
        const camera = new THREE.PerspectiveCamera();

        encounter.setEnemyPosition('melee_0', 0, 1, 5);
        encounter.setEnemyPosition('melee_1', 12, 1, 12);
        encounter.update(0, camera);
        expect(encounter.resolvePendingMeleeAttack('melee_0')).toBe(true);
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            actionId: 101,
            kind: 'player-damaged',
            source: 'melee',
            station: 'phonk',
            transformed: true,
            targets: [{ targetId: 'player', damageAccepted: 20 }]
        });

        encounter.setEnemyPosition('melee_1', 0, 1, 5);
        encounter.update(0, camera);
        expect(encounter.resolvePendingMeleeAttack('melee_1')).toBe(true);
        expect(events).toHaveLength(1);
        expect(player.hp).toBe(80);
    });
});
