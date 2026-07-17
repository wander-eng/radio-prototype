import { describe, expect, it } from 'vitest';
import {
    advanceProjectile,
    advanceRangedState,
    captureProjectileDirection,
    PROJECTILE_MAX_LIFE_SECONDS,
    rangedDistanceAction,
    rangedRespawnSnapshot,
    RANGED_DYING_SECONDS,
    RANGED_RECOVERY_SECONDS,
    RANGED_RESPAWN_SECONDS,
    RANGED_WINDUP_SECONDS,
    projectileOutsideArena,
    spheresIntersect3D
} from './ranged-math';

describe('ranged reposition math', () => {
    it('approaches when too far, retreats when too close and holds inside 6-9', () => {
        expect(rangedDistanceAction(10)).toBe('approach');
        expect(rangedDistanceAction(5)).toBe('retreat');
        expect(rangedDistanceAction(6)).toBe('hold');
        expect(rangedDistanceAction(7.5)).toBe('hold');
        expect(rangedDistanceAction(9)).toBe('hold');
    });
});

describe('ranged FSM', () => {
    it('transitions reposition -> windup -> attack -> recovery -> reposition', () => {
        const windup = advanceRangedState('reposition', 0, 0, true);
        expect(windup).toMatchObject({ state: 'windup', timer: RANGED_WINDUP_SECONDS });
        const attack = advanceRangedState('windup', windup.timer, RANGED_WINDUP_SECONDS, true);
        expect(attack.state).toBe('attack');
        const recovery = advanceRangedState('attack', 0, 1 / 60, true);
        expect(recovery).toMatchObject({
            state: 'recovery',
            timer: RANGED_RECOVERY_SECONDS,
            fireProjectile: true
        });
        expect(advanceRangedState('recovery', recovery.timer, RANGED_RECOVERY_SECONDS, true).state)
            .toBe('reposition');
    });

    it('fires only once per cycle', () => {
        const fired = advanceRangedState('attack', 0, 0, true);
        expect(fired.fireProjectile).toBe(true);
        expect(advanceRangedState(fired.state, fired.timer, 1 / 60, true).fireProjectile).toBe(false);
    });

    it('does not move or fire while dying/dead and respawns independently after 3s', () => {
        expect(advanceRangedState('dying', RANGED_DYING_SECONDS, 0.1, true)).toMatchObject({
            state: 'dying',
            fireProjectile: false
        });
        const dead = advanceRangedState('dying', RANGED_DYING_SECONDS, RANGED_DYING_SECONDS, false);
        expect(dead.timer).toBeCloseTo(RANGED_RESPAWN_SECONDS - RANGED_DYING_SECONDS);
        expect(advanceRangedState('dead', 0.01, 0.01, false)).toMatchObject({
            state: 'reposition',
            respawn: true
        });
        expect(rangedRespawnSnapshot(40, { x: 0, y: 1, z: -8 })).toEqual({
            hp: 40,
            state: 'reposition',
            position: { x: 0, y: 1, z: -8 }
        });
    });
});

describe('enemy projectile math', () => {
    it('captures direction at fire time and never changes it afterwards', () => {
        const direction = captureProjectileDirection(
            { x: 0, y: 1, z: -8 },
            { x: 0, y: 1, z: 4 }
        );
        const moved = advanceProjectile({
            position: { x: 0, y: 1, z: -8 },
            direction,
            remainingLife: PROJECTILE_MAX_LIFE_SECONDS
        }, 1);
        expect(direction).toEqual({ x: 0, y: 0, z: 1 });
        expect(moved.direction).toEqual(direction);
        expect(moved.position.z).toBe(-1);
    });

    it('uses spherical 3D collision so vertical evasion is possible', () => {
        expect(spheresIntersect3D({ x: 0, y: 1, z: 0 }, 0.35, { x: 0.8, y: 1, z: 0 }, 0.5))
            .toBe(true);
        expect(spheresIntersect3D({ x: 0, y: 1, z: 0 }, 0.35, { x: 0, y: 2, z: 0 }, 0.5))
            .toBe(false);
    });

    it('expires after four seconds and detects arena exit', () => {
        const expired = advanceProjectile({
            position: { x: 0, y: 1, z: 0 },
            direction: { x: 1, y: 0, z: 0 },
            remainingLife: PROJECTILE_MAX_LIFE_SECONDS
        }, 4);
        expect(expired.remainingLife).toBe(0);
        expect(projectileOutsideArena({ x: 12.01, y: 1, z: 0 })).toBe(true);
        expect(projectileOutsideArena({ x: 12, y: 1, z: -12 })).toBe(false);
    });

});
