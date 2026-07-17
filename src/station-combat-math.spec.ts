import { describe, expect, it } from 'vitest';
import {
    createTimeStep,
    decideSambaCounterHit,
    decideForroDashEnergy,
    resolveAttackAim,
    selectSoftAimTarget,
    updateCombatWindow,
    updateSlowMotionTimer
} from './station-combat-math';
import { drainTransformationEnergy } from './combat-math';

describe('station combat time', () => {
    it('applies timeScale only to scaled delta', () => {
        expect(createTimeStep(0.1, 0.5)).toEqual({
            unscaledDeltaSeconds: 0.1,
            scaledDeltaSeconds: 0.05
        });
    });

    it('ends 150ms slow motion by unscaled time', () => {
        let timer = 0.15;
        timer = updateSlowMotionTimer(timer, 0.1);
        timer = updateSlowMotionTimer(timer, 0.05);
        expect(timer).toBe(0);
    });

    it('updates combat windows with scaled gameplay time', () => {
        expect(updateCombatWindow(1, createTimeStep(0.2, 0.5).scaledDeltaSeconds)).toBeCloseTo(0.9);
    });

    it('does not prolong transformation drain during slow motion', () => {
        const step = createTimeStep(1, 0.5);
        expect(drainTransformationEnergy(100, step.unscaledDeltaSeconds))
            .toBeCloseTo(drainTransformationEnergy(100, 1));
        expect(drainTransformationEnergy(100, step.scaledDeltaSeconds))
            .toBeGreaterThan(drainTransformationEnergy(100, step.unscaledDeltaSeconds));
    });
});

describe('Forro dash energy', () => {
    it('grants once on the first applied hit and again on a new dash', () => {
        const first = decideForroDashEnergy(false, true, false);
        expect(first).toEqual({ grantEnergy: true, grantedForDash: true });
        expect(decideForroDashEnergy(first.grantedForDash, true, false).grantEnergy).toBe(false);
        expect(decideForroDashEnergy(false, true, false).grantEnergy).toBe(true);
    });

    it('does not grant for misses, invalid hits or transformed state', () => {
        expect(decideForroDashEnergy(false, false, false).grantEnergy).toBe(false);
        expect(decideForroDashEnergy(false, true, true).grantEnergy).toBe(false);
    });
});

describe('Samba counter', () => {
    it('multiplies the next valid hit by 1.5 and consumes only after application', () => {
        expect(decideSambaCounterHit(10, true, true)).toEqual({ damage: 15, consumeCounter: true });
        expect(decideSambaCounterHit(10, true, false)).toEqual({ damage: 15, consumeCounter: false });
        expect(decideSambaCounterHit(10, false, true)).toEqual({ damage: 10, consumeCounter: false });
    });
});

describe('soft aim assist', () => {
    const origin = { x: 0, z: 0 };
    const forward = { x: 0, z: 1 };

    it('ignores candidates outside 4.5 units, outside 20 degrees, dead or inactive', () => {
        const result = selectSoftAimTarget(origin, forward, [
            { id: 'far', x: 0, z: 5, active: true },
            { id: 'wide', x: 3, z: 3, active: true },
            { id: 'dead', x: 0, z: 3, active: false }
        ]);
        expect(result.candidateId).toBeNull();
        expect(result.direction).toEqual(forward);
    });

    it('chooses the smallest angular error and uses distance as tie-breaker', () => {
        expect(selectSoftAimTarget(origin, forward, [
            { id: 'wider', x: 0.5, z: 3, active: true },
            { id: 'straight', x: 0, z: 4, active: true }
        ]).candidateId).toBe('straight');

        expect(selectSoftAimTarget(origin, forward, [
            { id: 'far', x: 0, z: 4, active: true },
            { id: 'near', x: 0, z: 2, active: true }
        ]).candidateId).toBe('near');
    });

    it('keeps a direct raycast direction ahead of fallback candidates', () => {
        const result = resolveAttackAim({ x: 1, z: 0 }, origin, forward, [
            { id: 'fallback', x: 0, z: 2, active: true }
        ]);
        expect(result.direction).toEqual({ x: 1, z: 0 });
        expect(result.assisted).toBe(false);
    });

    it('does not change direction when no candidate is valid', () => {
        expect(selectSoftAimTarget(origin, forward, []).direction).toEqual(forward);
    });
});
