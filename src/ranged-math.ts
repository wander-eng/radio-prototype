import type { Position3D } from './melee-math';

export type RangedState = 'reposition' | 'windup' | 'attack' | 'recovery' | 'dying' | 'dead';
export type RangedDistanceAction = 'approach' | 'retreat' | 'hold';

export interface RangedStateUpdate {
    state: RangedState;
    timer: number;
    fireProjectile: boolean;
    respawn: boolean;
}

export interface ProjectileMotion {
    position: Position3D;
    direction: Position3D;
    remainingLife: number;
}

export const RANGED_MIN_DISTANCE = 6;
export const RANGED_MAX_DISTANCE = 9;
export const RANGED_WINDUP_SECONDS = 0.8;
export const RANGED_RECOVERY_SECONDS = 1.2;
export const RANGED_DYING_SECONDS = 0.3;
export const RANGED_RESPAWN_SECONDS = 3;
export const PROJECTILE_SPEED = 7;
export const PROJECTILE_RADIUS = 0.35;
export const PROJECTILE_MAX_LIFE_SECONDS = 4;
export const PROJECTILE_DAMAGE = 15;
const TIMER_EPSILON = Number.EPSILON * 16;

export function rangedDistanceAction(
    distance: number,
    minimum: number = RANGED_MIN_DISTANCE,
    maximum: number = RANGED_MAX_DISTANCE
): RangedDistanceAction {
    if (distance < minimum) return 'retreat';
    if (distance > maximum) return 'approach';
    return 'hold';
}

export function advanceRangedState(
    state: RangedState,
    timer: number,
    deltaSeconds: number,
    inPreferredRange: boolean
): RangedStateUpdate {
    const delta = Math.max(0, deltaSeconds);

    if (state === 'reposition') {
        return inPreferredRange
            ? { state: 'windup', timer: RANGED_WINDUP_SECONDS, fireProjectile: false, respawn: false }
            : { state, timer: 0, fireProjectile: false, respawn: false };
    }

    if (state === 'attack') {
        return {
            state: 'recovery',
            timer: RANGED_RECOVERY_SECONDS,
            fireProjectile: true,
            respawn: false
        };
    }

    const rawRemaining = Math.max(0, timer - delta);
    const remaining = rawRemaining <= TIMER_EPSILON ? 0 : rawRemaining;

    if (state === 'windup') {
        return remaining === 0
            ? { state: 'attack', timer: 0, fireProjectile: false, respawn: false }
            : { state, timer: remaining, fireProjectile: false, respawn: false };
    }

    if (state === 'recovery') {
        return remaining === 0
            ? { state: 'reposition', timer: 0, fireProjectile: false, respawn: false }
            : { state, timer: remaining, fireProjectile: false, respawn: false };
    }

    if (state === 'dying') {
        return remaining === 0
            ? {
                state: 'dead',
                timer: Math.max(0, RANGED_RESPAWN_SECONDS - RANGED_DYING_SECONDS),
                fireProjectile: false,
                respawn: false
            }
            : { state, timer: remaining, fireProjectile: false, respawn: false };
    }

    return remaining === 0
        ? { state: 'reposition', timer: 0, fireProjectile: false, respawn: true }
        : { state, timer: remaining, fireProjectile: false, respawn: false };
}

export function rangedWindupProgress(
    remaining: number,
    duration: number = RANGED_WINDUP_SECONDS
): number {
    if (duration <= 0) return 1;
    return Math.min(1, Math.max(0, 1 - remaining / duration));
}

export function captureProjectileDirection(origin: Position3D, target: Position3D): Position3D {
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const dz = target.z - origin.z;
    const length = Math.hypot(dx, dy, dz);
    if (length === 0) return { x: 0, y: 0, z: 1 };
    return { x: dx / length, y: dy / length, z: dz / length };
}

export function advanceProjectile(motion: ProjectileMotion, deltaSeconds: number): ProjectileMotion {
    const delta = Math.max(0, deltaSeconds);
    return {
        position: {
            x: motion.position.x + motion.direction.x * PROJECTILE_SPEED * delta,
            y: motion.position.y + motion.direction.y * PROJECTILE_SPEED * delta,
            z: motion.position.z + motion.direction.z * PROJECTILE_SPEED * delta
        },
        direction: { ...motion.direction },
        remainingLife: Math.max(0, motion.remainingLife - delta)
    };
}

export function spheresIntersect3D(
    first: Position3D,
    firstRadius: number,
    second: Position3D,
    secondRadius: number
): boolean {
    const combinedRadius = Math.max(0, firstRadius) + Math.max(0, secondRadius);
    return Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z) <= combinedRadius;
}

export function projectileOutsideArena(position: Position3D, min: number = -12, max: number = 12): boolean {
    const lower = Math.min(min, max);
    const upper = Math.max(min, max);
    return position.x < lower || position.x > upper || position.z < lower || position.z > upper;
}

export function rangedRespawnSnapshot(maxHp: number, spawn: Position3D) {
    return { hp: Math.max(0, maxHp), state: 'reposition' as const, position: { ...spawn } };
}
