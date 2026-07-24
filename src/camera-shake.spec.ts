import { describe, expect, it, vi } from 'vitest';
import {
    CameraShakeController,
    cameraShakeOffsetForImpulse,
    cameraShakeProfileForImpact,
    clampShakeStrength,
    DEFAULT_SHAKE_STRENGTH,
    deterministicShakePhase,
    MAX_CAMERA_SHAKE_OFFSET,
    shakeDecay,
    sumAndClampShakeOffsets
} from './camera-shake';
import { createImpactEvent, type ImpactKind } from './impact-event';

function event(
    kind: ImpactKind,
    actionId: number = 1,
    transformed: boolean = false
) {
    return createImpactEvent({
        actionId,
        kind,
        source: kind === 'player-damaged' ? 'melee' : 'basic-attack',
        station: null,
        transformed,
        origin: { x: 1, y: 2, z: 3 },
        direction: { x: 1, y: 0, z: 0 },
        targets: kind === 'miss' ? [] : [{
            targetId: kind === 'player-damaged' ? 'player' : 'target',
            position: { x: 2, y: 1, z: 3 },
            damageAccepted: 10,
            killed: kind === 'enemy-kill'
        }]
    });
}

describe('camera shake tuning and pure math', () => {
    it.each([
        ['miss', 0, 0],
        ['normal', 0.025, 0.1],
        ['phonk-strong', 0.045, 0.12],
        ['samba-counter', 0.035, 0.1],
        ['forro-multi', 0.05, 0.13],
        ['enemy-kill', 0.075, 0.16],
        ['player-damaged', 0.08, 0.18],
        ['samba-dodge', 0.02, 0.08]
    ] as const)('maps %s to amplitude %s and duration %s', (kind, amplitude, duration) => {
        expect(cameraShakeProfileForImpact(event(kind))).toMatchObject({
            amplitude,
            duration
        });
    });

    it('applies transformed amplitude before the global ceiling', () => {
        expect(cameraShakeProfileForImpact(event('normal', 1, true)).amplitude)
            .toBeCloseTo(0.03);
        expect(cameraShakeProfileForImpact(event('player-damaged', 1, true)).amplitude)
            .toBeCloseTo(0.096);
    });

    it('applies distinct station signatures without changing the category ceiling', () => {
        const base = event('normal');
        const phonk = cameraShakeProfileForImpact({ ...base, station: 'phonk' });
        const samba = cameraShakeProfileForImpact({ ...base, station: 'samba' });
        const forro = cameraShakeProfileForImpact({ ...base, station: 'forro' });
        expect(phonk.duration).toBeLessThan(forro.duration);
        expect(phonk.amplitude).toBeGreaterThan(samba.amplitude);
        expect(samba.axisX).toBeLessThan(samba.axisZ!);
        expect(forro.amplitude).toBeLessThanOrEqual(MAX_CAMERA_SHAKE_OFFSET);
    });

    it('uses default strength one and clamps comfort multiplier', () => {
        expect(DEFAULT_SHAKE_STRENGTH).toBe(1);
        expect(clampShakeStrength(-1)).toBe(0);
        expect(clampShakeStrength(0.4)).toBe(0.4);
        expect(clampShakeStrength(2)).toBe(1);
        expect(clampShakeStrength(Number.POSITIVE_INFINITY)).toBe(1);
        expect(clampShakeStrength(Number.NEGATIVE_INFINITY)).toBe(0);
        expect(clampShakeStrength(Number.NaN)).toBe(0);
    });

    it('produces zero with strength zero and clamps summed impulses', () => {
        const offsets = [
            { x: 0.08, y: 0, z: 0 },
            { x: 0.08, y: 0, z: 0 }
        ];
        expect(sumAndClampShakeOffsets(offsets, 0)).toEqual({ x: 0, y: 0, z: 0 });
        expect(Math.hypot(...Object.values(sumAndClampShakeOffsets(offsets, 1))))
            .toBeCloseTo(MAX_CAMERA_SHAKE_OFFSET);
    });

    it('uses deterministic phase, offset and ease-out decay without Math.random', () => {
        const random = vi.spyOn(Math, 'random');
        const phaseA = deterministicShakePhase(4, { x: 1, y: 2, z: 3 });
        const phaseB = deterministicShakePhase(4, { x: 1, y: 2, z: 3 });
        const impulse = {
            actionId: 4,
            amplitude: 0.05,
            duration: 0.1,
            frequency: 30,
            phase: phaseA,
            elapsed: 0.04
        };
        expect(phaseA).toBe(phaseB);
        expect(cameraShakeOffsetForImpulse(impulse))
            .toEqual(cameraShakeOffsetForImpulse(impulse));
        expect(shakeDecay(0)).toBe(1);
        expect(shakeDecay(0.5)).toBe(0.25);
        expect(shakeDecay(1)).toBe(0);
        expect(random).not.toHaveBeenCalled();
        random.mockRestore();
    });
});

describe('CameraShakeController', () => {
    it('deduplicates one global Forro action and respects the summed ceiling', () => {
        const controller = new CameraShakeController();
        const forro = event('forro-multi', 10);
        expect(controller.request(forro)).toBe(true);
        expect(controller.request(forro)).toBe(false);
        for (let actionId = 11; actionId < 20; actionId++) {
            controller.request(event('enemy-kill', actionId, true));
        }
        const offset = controller.advance(0.001);
        expect(controller.snapshot.activeImpulseCount).toBe(10);
        expect(Math.hypot(offset.x, offset.y, offset.z))
            .toBeLessThanOrEqual(MAX_CAMERA_SHAKE_OFFSET);
    });

    it('animates with presentation delta during hitstop and returns exactly to zero', () => {
        const controller = new CameraShakeController();
        controller.request(event('normal'));
        const duringHitstop = controller.advance(0.03);
        expect(Math.hypot(duringHitstop.x, duringHitstop.y, duringHitstop.z))
            .toBeGreaterThan(0);
        expect(controller.advance(0.07)).toEqual({ x: 0, y: 0, z: 0 });
        expect(controller.snapshot.active).toBe(false);
    });

    it('neutralizes and freezes while paused, then resumes remaining duration', () => {
        const controller = new CameraShakeController();
        controller.request(event('normal'));
        controller.advance(0.03);
        controller.setPaused(true);
        expect(controller.advance(1)).toEqual({ x: 0, y: 0, z: 0 });
        expect(controller.snapshot).toMatchObject({
            active: true,
            intensity: 0
        });

        controller.setPaused(false);
        expect(Math.hypot(...Object.values(controller.advance(0.01))))
            .toBeGreaterThan(0);
        expect(controller.advance(0.06)).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('keeps timers active with strength zero and reset is idempotent', () => {
        const controller = new CameraShakeController();
        controller.shakeStrength = 0;
        controller.request(event('player-damaged'));
        expect(controller.advance(0.05)).toEqual({ x: 0, y: 0, z: 0 });
        expect(controller.snapshot.active).toBe(true);

        controller.reset();
        const firstReset = controller.snapshot;
        controller.reset();
        expect(controller.snapshot).toEqual(firstReset);
        expect(firstReset).toMatchObject({
            active: false,
            intensity: 0,
            shakeStrength: 0
        });
    });
});
