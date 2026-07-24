import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UIManager } from './hud';
import { createImpactEvent, type ImpactEvent, type ImpactKind } from './impact-event';
import { MeleeAttackToken } from './melee-attack-token';
import { MeleeEnemy } from './melee-enemy';
import { Player } from './player';
import { RangedEnemy } from './ranged-enemy';
import { Target } from './target';

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

function impactFor(
    targetId: string,
    kind: ImpactKind = 'normal',
    killed: boolean = false,
    transformed: boolean = false
): ImpactEvent {
    return createImpactEvent({
        actionId: 1,
        kind,
        source: kind === 'player-damaged' ? 'melee' : 'basic-attack',
        station: kind === 'player-damaged' ? null : 'phonk',
        transformed,
        origin: { x: 0, y: 1, z: 0 },
        direction: { x: 1, y: 4, z: 0 },
        targets: [{
            targetId,
            position: { x: 1, y: 1, z: 0 },
            damageAccepted: 10,
            killed
        }]
    });
}

function applyEvent(
    entity: {
        applyImpactReaction(
            event: ImpactEvent,
            target: ImpactEvent['targets'][number]
        ): void;
    },
    event: ImpactEvent
) {
    entity.applyImpactReaction(event, event.targets[0]);
}

describe('local impact reaction integration', () => {
    beforeEach(() => {
        vi.stubGlobal('document', {
            createElement: vi.fn(createElementStub),
            body: { appendChild: vi.fn() }
        });
        vi.stubGlobal('window', { innerWidth: 1280, innerHeight: 720 });
    });

    it('keeps melee FSM and token while flash temporarily overrides its telegraph body', () => {
        const token = new MeleeAttackToken();
        const player = createPlayer();
        player.mesh.position.set(0, 1, 1);
        const melee = new MeleeEnemy(
            'melee_test',
            new THREE.Vector3(0, 1, 0),
            token,
            1
        );
        const camera = new THREE.PerspectiveCamera();

        melee.update(0, player, camera);
        expect(melee.meleeState).toBe('windup');
        expect(token.ownerId).toBe(melee.id);

        applyEvent(melee, impactFor(melee.id));
        const material = melee.mesh.material as THREE.MeshStandardMaterial;
        expect(melee.impactReactionSnapshot.flashActive).toBe(true);
        expect(material.color.getHex()).toBe(0xffffff);

        melee.updateImpactReaction(0.08, 0);
        melee.update(0.2, player, camera);

        expect(melee.impactReactionSnapshot.flashActive).toBe(false);
        expect(melee.telegraphActive).toBe(true);
        expect(melee.telegraphProgress).toBeGreaterThan(0);
        expect(material.color.getHex()).not.toBe(0xffffff);
        expect(token.ownerId).toBe(melee.id);
    });

    it('moves melee only with gameplay delta and reset restores spawn without changing FSM rules', () => {
        const melee = new MeleeEnemy(
            'melee_test',
            new THREE.Vector3(0, 1, 0),
            new MeleeAttackToken(),
            1
        );
        applyEvent(melee, impactFor(melee.id, 'phonk-strong', false, true));

        melee.updateImpactReaction(0.04, 0);
        expect(melee.mesh.position.x).toBe(0);
        expect(melee.impactReactionSnapshot.knockbackActive).toBe(true);

        melee.updateImpactReaction(0, 0.04);
        expect(melee.mesh.position.x).toBeGreaterThan(0);
        expect(melee.meleeState).toBe('chase');

        melee.reset();
        expect(melee.mesh.position.toArray()).toEqual([0, 1, 0]);
        expect(melee.impactReactionSnapshot).toMatchObject({
            flashActive: false,
            knockbackActive: false
        });
    });

    it('clears lethal ranged reaction on individual respawn', () => {
        const ranged = new RangedEnemy(
            'ranged_test',
            new THREE.Vector3(0, 1, -8),
            vi.fn()
        );
        const player = createPlayer();
        const camera = new THREE.PerspectiveCamera();

        const result = ranged.receiveHit(new THREE.Vector3(1, 0, 0), 40);
        expect(result.killed).toBe(true);
        applyEvent(ranged, impactFor(ranged.id, 'enemy-kill', true));
        expect(ranged.impactReactionSnapshot.flashActive).toBe(true);

        ranged.updateImpactReaction(0.05, 0.05);
        ranged.update(0.3, player, camera);
        ranged.update(3, player, camera);

        expect(ranged.state).toBe('active');
        expect(ranged.rangedState).toBe('reposition');
        expect(ranged.mesh.position.toArray()).toEqual([0, 1, -8]);
        expect(ranged.impactReactionSnapshot).toMatchObject({
            flashActive: false,
            knockbackActive: false
        });
    });

    it('restores the player current logical color after damage flash and never displaces it', () => {
        const player = createPlayer();
        const event = impactFor('player', 'player-damaged');
        const initialPosition = player.mesh.position.clone();

        applyEvent(player, event);
        player.setEmissiveColor(0x39ff14);
        expect(player.impactReactionSnapshot.flashActive).toBe(true);
        player.updateImpactReaction(0.12, 1);

        const material = player.mesh.material as THREE.MeshStandardMaterial;
        expect(player.mesh.position.toArray()).toEqual(initialPosition.toArray());
        expect(player.impactReactionSnapshot.flashActive).toBe(false);
        expect(material.color.getHex()).toBe(0x39ff14);
        expect(material.emissive.getHex()).toBe(0x39ff14);
    });

    it('keeps the training target lifecycle and clears reaction on respawn', () => {
        const target = new Target('target_test', new THREE.Vector3(0, 1, 0));
        const camera = new THREE.PerspectiveCamera();
        const result = target.receiveHit(new THREE.Vector3(1, 0, 0), 100);
        expect(result.killed).toBe(true);
        applyEvent(target, impactFor(target.id, 'enemy-kill', true));

        target.updateImpactReaction(0.04, 0.04);
        target.update(1, camera);
        target.update(2.1, camera);

        expect(target.state).toBe('active');
        expect(target.hp).toBe(target.maxHp);
        expect(target.mesh.position.toArray()).toEqual([0, 1, 0]);
        expect(target.impactReactionSnapshot).toMatchObject({
            flashActive: false,
            knockbackActive: false
        });
    });
});
