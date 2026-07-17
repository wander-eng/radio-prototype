import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { UIManager } from './hud';
import type { InputManager } from './input';
import { Player } from './player';
import { StationId } from './radio';

function createHudMock() {
    return {
        updatePlayerHP: vi.fn(),
        updateCombo: vi.fn(),
        setStation: vi.fn(),
        showPopup: vi.fn()
    } as unknown as UIManager;
}

function createInputMock(pressed: string[] = []) {
    const pressedKeys = new Set(pressed);
    return {
        mousePosition: null,
        isPressed: (code: string) => pressedKeys.has(code),
        consumePress: () => false
    } as unknown as InputManager;
}

function createCamera() {
    return new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 1000);
}

describe('Player damage foundation', () => {
    it('ignora um segundo golpe melee durante a invulnerabilidade global', () => {
        const player = new Player(createHudMock(), vi.fn());

        expect(player.receiveAttack(20).damageApplied).toBe(20);
        expect(player.receiveAttack(20).damageApplied).toBe(0);
        expect(player.hp).toBe(80);
    });

    it('aplica dano, atualiza o HUD e ignora novo ataque por 0,5s', () => {
        const hud = createHudMock();
        const player = new Player(hud, vi.fn());

        const firstHit = player.receiveAttack(25);
        expect(firstHit.damageApplied).toBe(25);
        expect(player.hp).toBe(75);
        expect(player.isDamageInvulnerable).toBe(true);
        expect(hud.updatePlayerHP).toHaveBeenLastCalledWith(75, 100);

        const ignoredHit = player.receiveAttack(50);
        expect(ignoredHit.ignoredByInvulnerability).toBe(true);
        expect(ignoredHit.damageApplied).toBe(0);
        expect(player.hp).toBe(75);

        player.updateCombatState(0.49);
        expect(player.isDamageInvulnerable).toBe(true);
        player.updateCombatState(0.01);
        expect(player.isDamageInvulnerable).toBe(false);

        player.receiveAttack(10);
        expect(player.hp).toBe(65);
    });

    it('permanece morto e bloqueia input até o reset manual', () => {
        const hud = createHudMock();
        const player = new Player(hud, vi.fn());
        const camera = createCamera();
        const idleInput = createInputMock();
        const movingInput = createInputMock(['KeyW']);

        player.update(0, idleInput, camera, [], StationId.PHONK, []);
        player.mesh.position.set(4, 1, 4);

        const lethalHit = player.receiveAttack(150);
        expect(lethalHit.killed).toBe(true);
        expect(lethalHit.damageApplied).toBe(100);
        expect(player.hp).toBe(0);
        expect(player.isDead).toBe(true);

        player.update(5, movingInput, camera, [], StationId.PHONK, []);
        expect(player.isDead).toBe(true);
        expect(player.mesh.position.toArray()).toEqual([4, 1, 4]);

        player.resetAfterDeath();
        expect(player.isDead).toBe(false);
        expect(player.hp).toBe(100);
        expect(player.mesh.position.toArray()).toEqual([0, 1, 4]);
        expect(player.activeStation).toBe(StationId.PHONK);
        expect(hud.updatePlayerHP).toHaveBeenLastCalledWith(100, 100);

        player.update(0.1, movingInput, camera, [], StationId.PHONK, []);
        expect(player.mesh.position.z).toBeLessThan(4);
    });

    it('o reset limpa movimento, dash, combo e estados temporarios sem trocar estacao', () => {
        const hud = createHudMock();
        const player = new Player(hud, vi.fn());
        const camera = createCamera();

        player.update(0, createInputMock(), camera, [], StationId.FORRO, []);
        player.update(0, createInputMock(['ShiftLeft']), camera, [], StationId.FORRO, []);
        expect(player.isCurrentlyDashing).toBe(true);
        player.mesh.position.set(8, 4, -5);
        player.receiveAttack(100);
        player.resetAfterDeath();

        expect(player.isCurrentlyDashing).toBe(false);
        expect(player.currentJumpCount).toBe(0);
        expect(player.comboCount).toBe(0);
        expect(player.forroDashEnergyWasGranted).toBe(false);
        expect(player.forroDashHitCount).toBe(0);
        expect(player.mesh.position.toArray()).toEqual([0, 1, 4]);
        expect(player.activeStation).toBe(StationId.FORRO);
        expect(hud.updateCombo).toHaveBeenLastCalledWith(0);
    });

    it('receber dano preserva a estação e não desfaz a manifestação transformada', () => {
        const player = new Player(createHudMock(), vi.fn());
        const stationColor = 0x39FF14;

        player.update(0, createInputMock(), createCamera(), [], StationId.PHONK, []);
        player.setEmissiveColor(stationColor);
        player.receiveAttack(10);

        const material = player.mesh.material as THREE.MeshStandardMaterial;
        expect(player.activeStation).toBe(StationId.PHONK);
        expect(material.color.getHex()).toBe(stationColor);
        expect(material.emissive.getHex()).toBe(stationColor);
    });
});

describe('Player Samba integration', () => {
    it('opens a 0.2s dodge window and a 1s counter without slow motion by dash alone', () => {
        const onDodge = vi.fn();
        const player = new Player(createHudMock(), vi.fn(), onDodge);
        const camera = createCamera();

        player.update(0, createInputMock(), camera, [], StationId.SAMBA, []);
        player.update(0, createInputMock(['ShiftLeft']), camera, [], StationId.SAMBA, []);

        expect(player.isSambaDodgeActive).toBe(true);
        expect(player.sambaCounterReady).toBe(true);
        expect(player.sambaCounterRemaining).toBe(1);
        expect(onDodge).not.toHaveBeenCalled();

        player.update(0.2, createInputMock(), camera, [], StationId.SAMBA, []);
        expect(player.isSambaDodgeActive).toBe(false);
    });

    it('turns a valid collision into one dodge and starts slow motion/counter', () => {
        const onDodge = vi.fn();
        const player = new Player(createHudMock(), vi.fn(), onDodge);
        const camera = createCamera();
        player.update(0, createInputMock(), camera, [], StationId.SAMBA, []);
        player.update(0, createInputMock(['ShiftLeft']), camera, [], StationId.SAMBA, []);

        expect(player.receiveAttack(20)).toMatchObject({
            outcome: 'dodged-samba',
            damageApplied: 0,
            threatConsumed: true
        });
        expect(player.hp).toBe(100);
        expect(player.isSambaDodgeActive).toBe(false);
        expect(player.sambaCounterReady).toBe(true);
        expect(onDodge).toHaveBeenCalledTimes(1);

        expect(player.receiveAttack(20).outcome).toBe('damage-applied');
        expect(onDodge).toHaveBeenCalledTimes(1);
    });

    it('does not count a globally ignored attack as a dodge or renew the dash counter', () => {
        const onDodge = vi.fn();
        const player = new Player(createHudMock(), vi.fn(), onDodge);
        const camera = createCamera();
        player.update(0, createInputMock(), camera, [], StationId.SAMBA, []);
        player.receiveAttack(20);
        player.update(0, createInputMock(['ShiftLeft']), camera, [], StationId.SAMBA, []);

        expect(player.receiveAttack(20).outcome).toBe('ignored-global-invulnerability');
        expect(player.sambaCounterReady).toBe(true);
        expect(player.sambaCounterRemaining).toBe(1);
        expect(onDodge).not.toHaveBeenCalled();
    });

    it('clears dodge and counter state on station change or death', () => {
        const player = new Player(createHudMock(), vi.fn(), vi.fn());
        const camera = createCamera();
        player.update(0, createInputMock(), camera, [], StationId.SAMBA, []);
        player.update(0, createInputMock(['ShiftLeft']), camera, [], StationId.SAMBA, []);
        player.receiveAttack(20);
        expect(player.sambaCounterReady).toBe(true);

        player.update(0, createInputMock(), camera, [], StationId.PHONK, []);
        expect(player.sambaCounterReady).toBe(false);
        expect(player.isSambaDodgeActive).toBe(false);

        player.updateCombatState(0.5);
        player.receiveAttack(100);
        expect(player.isDead).toBe(true);
        expect(player.sambaCounterReady).toBe(false);
    });

    it('renews without stacking and expires after one second of gameplay time', () => {
        const player = new Player(createHudMock(), vi.fn(), vi.fn());
        const camera = createCamera();
        player.update(0, createInputMock(), camera, [], StationId.SAMBA, []);
        player.update(0, createInputMock(['ShiftLeft']), camera, [], StationId.SAMBA, []);
        player.receiveAttack(20);
        expect(player.sambaCounterRemaining).toBe(1);

        player.update(0.4, createInputMock(), camera, [], StationId.SAMBA, []);
        expect(player.sambaCounterRemaining).toBeCloseTo(0.6);
        player.update(0.6, createInputMock(), camera, [], StationId.SAMBA, []);
        expect(player.sambaCounterReady).toBe(false);
    });
});
