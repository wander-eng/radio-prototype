import { describe, expect, it } from 'vitest';
import {
    advanceMeleeState,
    clampArenaPosition,
    MELEE_DYING_SECONDS,
    MELEE_RECOVERY_SECONDS,
    MELEE_RESPAWN_SECONDS,
    MELEE_WINDUP_SECONDS,
    meleeAttackHits,
    meleeRespawnSnapshot,
    separatePositionXZ,
    windupProgress
} from './melee-math';

describe('arena combat math', () => {
    it('clamps X/Z to the 24 x 24 arena', () => {
        expect(clampArenaPosition({ x: -20, z: 18 })).toEqual({ x: -12, z: 12 });
        expect(clampArenaPosition({ x: 4, z: -3 })).toEqual({ x: 4, z: -3 });
    });

    it('separates only overlapping positions in XZ', () => {
        expect(separatePositionXZ({ x: 0.2, z: 0 }, { x: 0, z: 0 }, 1)).toEqual({ x: 1, z: 0 });
        expect(separatePositionXZ({ x: 2, z: 0 }, { x: 0, z: 0 }, 1)).toEqual({ x: 2, z: 0 });
    });
});

describe('melee attack volume', () => {
    const melee = { x: 0, y: 1, z: 0 };

    it('hits inside both horizontal and vertical bounds', () => {
        expect(meleeAttackHits(melee, { x: 1.4, y: 2.2, z: 0 }, 1.5, 1.25)).toBe(true);
    });

    it('misses outside horizontal range', () => {
        expect(meleeAttackHits(melee, { x: 1.6, y: 1, z: 0 }, 1.5, 1.25)).toBe(false);
    });

    it('misses a player sufficiently high above the melee', () => {
        expect(meleeAttackHits(melee, { x: 1, y: 2.3, z: 0 }, 1.5, 1.25)).toBe(false);
    });
});

describe('melee FSM', () => {
    it('transitions chase -> windup only when in range', () => {
        expect(advanceMeleeState('chase', 0, 1, false).state).toBe('chase');
        expect(advanceMeleeState('chase', 0, 1, true)).toMatchObject({
            state: 'windup',
            timer: MELEE_WINDUP_SECONDS
        });
    });

    it('uses deltaSeconds for windup and transitions windup -> attack', () => {
        const halfway = advanceMeleeState('windup', MELEE_WINDUP_SECONDS, 0.3, true);
        expect(halfway).toMatchObject({ state: 'windup', timer: 0.3 });
        expect(windupProgress(halfway.timer)).toBeCloseTo(0.5);
        expect(advanceMeleeState(halfway.state, halfway.timer, 0.3, true).state).toBe('attack');
    });

    it('resolves attack exactly once while transitioning attack -> recovery', () => {
        const attack = advanceMeleeState('attack', 0, 1 / 60, true);
        expect(attack).toMatchObject({
            state: 'recovery',
            timer: MELEE_RECOVERY_SECONDS,
            resolveAttack: true
        });
        expect(advanceMeleeState(attack.state, attack.timer, 1 / 60, true).resolveAttack).toBe(false);
    });

    it('uses deltaSeconds for recovery and transitions recovery -> chase', () => {
        const almost = advanceMeleeState('recovery', MELEE_RECOVERY_SECONDS, 0.79, true);
        expect(almost.state).toBe('recovery');
        expect(almost.timer).toBeCloseTo(0.01);
        expect(advanceMeleeState(almost.state, almost.timer, 0.01, true).state).toBe('chase');
    });

    it('does not chase or resolve attacks while dying or dead', () => {
        expect(advanceMeleeState('dying', MELEE_DYING_SECONDS, 0.1, true)).toMatchObject({
            state: 'dying',
            resolveAttack: false
        });
        expect(advanceMeleeState('dead', MELEE_RESPAWN_SECONDS, 1, true)).toMatchObject({
            state: 'dead',
            resolveAttack: false,
            respawn: false
        });
    });

    it('respawns after three seconds into chase', () => {
        const dead = advanceMeleeState('dying', MELEE_DYING_SECONDS, MELEE_DYING_SECONDS, false);
        expect(dead).toMatchObject({
            state: 'dead',
            timer: MELEE_RESPAWN_SECONDS - MELEE_DYING_SECONDS
        });
        expect(advanceMeleeState(dead.state, dead.timer, 2.69, false).respawn).toBe(false);
        expect(advanceMeleeState('dead', 0.01, 0.01, false)).toMatchObject({
            state: 'chase',
            respawn: true
        });

        expect(meleeRespawnSnapshot(50, { x: -3, y: 1, z: -3 })).toEqual({
            hp: 50,
            state: 'chase',
            position: { x: -3, y: 1, z: -3 }
        });
    });

    it('does not deal contact damage when chase reaches the player', () => {
        expect(advanceMeleeState('chase', 0, 1 / 60, true)).toMatchObject({
            state: 'windup',
            resolveAttack: false
        });
    });
});
