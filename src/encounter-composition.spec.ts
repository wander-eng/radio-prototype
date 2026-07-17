import { describe, expect, it } from 'vitest';
import { MeleeAttackToken } from './melee-attack-token';
import { advanceMeleeState, meleeRespawnSnapshot } from './melee-math';
import { advanceRangedState, rangedRespawnSnapshot } from './ranged-math';

describe('encounter composition rules', () => {
    it('allows only one melee in windup/attack at a time', () => {
        const token = new MeleeAttackToken();
        expect(token.tryAcquire('melee_a')).toBe(true);
        expect(advanceMeleeState('chase', 0, 0, true).state).toBe('windup');
        expect(token.tryAcquire('melee_b')).toBe(false);
    });

    it('lets ranged progress independently from the melee token', () => {
        const token = new MeleeAttackToken();
        token.tryAcquire('melee_a');
        expect(advanceRangedState('reposition', 0, 0, true).state).toBe('windup');
        expect(token.ownerId).toBe('melee_a');
    });

    it('keeps enemy lifecycles and respawns independent', () => {
        const token = new MeleeAttackToken();
        token.tryAcquire('melee_a');
        token.release('melee_a');

        expect(meleeRespawnSnapshot(50, { x: -3, y: 1, z: -3 }).state).toBe('chase');
        expect(rangedRespawnSnapshot(40, { x: 0, y: 1, z: -8 }).state).toBe('reposition');
        expect(advanceMeleeState('chase', 0, 0, false).state).toBe('chase');
        expect(advanceRangedState('recovery', 1, 0.5, false).state).toBe('recovery');
    });
});
