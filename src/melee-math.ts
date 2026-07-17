export type MeleeState = 'chase' | 'windup' | 'attack' | 'recovery' | 'dying' | 'dead';

export interface PositionXZ {
    x: number;
    z: number;
}

export interface Position3D extends PositionXZ {
    y: number;
}

export interface MeleeStateUpdate {
    state: MeleeState;
    timer: number;
    resolveAttack: boolean;
    respawn: boolean;
}

export interface MeleeRespawnSnapshot {
    hp: number;
    state: 'chase';
    position: Position3D;
}

export const ARENA_MIN = -12;
export const ARENA_MAX = 12;
export const MELEE_WINDUP_SECONDS = 0.6;
export const MELEE_RECOVERY_SECONDS = 0.8;
export const MELEE_DYING_SECONDS = 0.3;
export const MELEE_RESPAWN_SECONDS = 3;
const TIMER_EPSILON = Number.EPSILON * 16;

export function clampArenaPosition(
    position: PositionXZ,
    min: number = ARENA_MIN,
    max: number = ARENA_MAX
): PositionXZ {
    const lower = Math.min(min, max);
    const upper = Math.max(min, max);
    return {
        x: Math.min(upper, Math.max(lower, position.x)),
        z: Math.min(upper, Math.max(lower, position.z))
    };
}

export function horizontalDistance(a: PositionXZ, b: PositionXZ): number {
    return Math.hypot(a.x - b.x, a.z - b.z);
}

export function meleeAttackHits(
    attacker: Position3D,
    target: Position3D,
    horizontalRange: number,
    verticalTolerance: number
): boolean {
    return horizontalDistance(attacker, target) <= Math.max(0, horizontalRange)
        && Math.abs(attacker.y - target.y) <= Math.max(0, verticalTolerance);
}

export function separatePositionXZ(
    movable: PositionXZ,
    obstacle: PositionXZ,
    minimumDistance: number
): PositionXZ {
    const safeDistance = Math.max(0, minimumDistance);
    const dx = movable.x - obstacle.x;
    const dz = movable.z - obstacle.z;
    const distance = Math.hypot(dx, dz);

    if (distance >= safeDistance || safeDistance === 0) return { ...movable };
    if (distance === 0) return { x: obstacle.x + safeDistance, z: obstacle.z };

    const scale = safeDistance / distance;
    return {
        x: obstacle.x + dx * scale,
        z: obstacle.z + dz * scale
    };
}

export function windupProgress(remaining: number, duration: number = MELEE_WINDUP_SECONDS): number {
    if (duration <= 0) return 1;
    return Math.min(1, Math.max(0, 1 - remaining / duration));
}

export function meleeRespawnSnapshot(maxHp: number, spawnPosition: Position3D): MeleeRespawnSnapshot {
    return {
        hp: Math.max(0, maxHp),
        state: 'chase',
        position: { ...spawnPosition }
    };
}

export function advanceMeleeState(
    state: MeleeState,
    timer: number,
    deltaSeconds: number,
    targetInHorizontalRange: boolean
): MeleeStateUpdate {
    const delta = Math.max(0, deltaSeconds);

    if (state === 'chase') {
        return targetInHorizontalRange
            ? { state: 'windup', timer: MELEE_WINDUP_SECONDS, resolveAttack: false, respawn: false }
            : { state, timer: 0, resolveAttack: false, respawn: false };
    }

    if (state === 'attack') {
        return {
            state: 'recovery',
            timer: MELEE_RECOVERY_SECONDS,
            resolveAttack: true,
            respawn: false
        };
    }

    const rawRemaining = Math.max(0, timer - delta);
    const remaining = rawRemaining <= TIMER_EPSILON ? 0 : rawRemaining;
    if (state === 'windup') {
        return remaining === 0
            ? { state: 'attack', timer: 0, resolveAttack: false, respawn: false }
            : { state, timer: remaining, resolveAttack: false, respawn: false };
    }

    if (state === 'recovery') {
        return remaining === 0
            ? { state: 'chase', timer: 0, resolveAttack: false, respawn: false }
            : { state, timer: remaining, resolveAttack: false, respawn: false };
    }

    if (state === 'dying') {
        return remaining === 0
            ? {
                state: 'dead',
                timer: Math.max(0, MELEE_RESPAWN_SECONDS - MELEE_DYING_SECONDS),
                resolveAttack: false,
                respawn: false
            }
            : { state, timer: remaining, resolveAttack: false, respawn: false };
    }

    return remaining === 0
        ? { state: 'chase', timer: 0, resolveAttack: false, respawn: true }
        : { state, timer: remaining, resolveAttack: false, respawn: false };
}
