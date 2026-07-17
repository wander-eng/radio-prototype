export interface TimeStep {
    unscaledDeltaSeconds: number;
    scaledDeltaSeconds: number;
}

export interface AimCandidate2D {
    id: string;
    x: number;
    z: number;
    active: boolean;
}

export interface AimSelection {
    candidateId: string | null;
    direction: { x: number; z: number };
    assisted: boolean;
}

export interface ForroDashEnergyDecision {
    grantEnergy: boolean;
    grantedForDash: boolean;
}

export interface SambaCounterHitDecision {
    damage: number;
    consumeCounter: boolean;
}

const DEGREES_TO_RADIANS = Math.PI / 180;

export function createTimeStep(unscaledDeltaSeconds: number, timeScale: number): TimeStep {
    const unscaled = Math.max(0, unscaledDeltaSeconds);
    const scale = Math.max(0, timeScale);
    return {
        unscaledDeltaSeconds: unscaled,
        scaledDeltaSeconds: unscaled * scale
    };
}

export function updateSlowMotionTimer(current: number, unscaledDeltaSeconds: number): number {
    return Math.max(0, current - Math.max(0, unscaledDeltaSeconds));
}

export function updateCombatWindow(current: number, scaledDeltaSeconds: number): number {
    return Math.max(0, current - Math.max(0, scaledDeltaSeconds));
}

export function decideForroDashEnergy(
    grantedForDash: boolean,
    hitApplied: boolean,
    transformed: boolean
): ForroDashEnergyDecision {
    const grantEnergy = !grantedForDash && hitApplied && !transformed;
    return {
        grantEnergy,
        grantedForDash: grantedForDash || (hitApplied && !transformed)
    };
}

export function decideSambaCounterHit(
    baseDamage: number,
    counterReady: boolean,
    hitApplied: boolean
): SambaCounterHitDecision {
    return {
        damage: counterReady ? Math.max(0, baseDamage) * 1.5 : Math.max(0, baseDamage),
        consumeCounter: counterReady && hitApplied
    };
}

export function selectSoftAimTarget(
    origin: { x: number; z: number },
    intendedDirection: { x: number; z: number },
    candidates: readonly AimCandidate2D[],
    maxDistance: number = 4.5,
    maxAngleDegrees: number = 20
): AimSelection {
    const intendedLength = Math.hypot(intendedDirection.x, intendedDirection.z);
    if (intendedLength === 0) {
        return { candidateId: null, direction: { x: 0, z: 0 }, assisted: false };
    }

    const intended = {
        x: intendedDirection.x / intendedLength,
        z: intendedDirection.z / intendedLength
    };
    const maxAngle = Math.max(0, maxAngleDegrees) * DEGREES_TO_RADIANS;
    const valid = candidates
        .filter(candidate => candidate.active)
        .map(candidate => {
            const dx = candidate.x - origin.x;
            const dz = candidate.z - origin.z;
            const distance = Math.hypot(dx, dz);
            if (distance === 0 || distance > Math.max(0, maxDistance)) return null;
            const direction = { x: dx / distance, z: dz / distance };
            const dot = Math.min(1, Math.max(-1, intended.x * direction.x + intended.z * direction.z));
            return { candidate, direction, distance, angle: Math.acos(dot) };
        })
        .filter((candidate): candidate is NonNullable<typeof candidate> =>
            candidate !== null && candidate.angle <= maxAngle
        )
        .sort((a, b) => a.angle - b.angle || a.distance - b.distance);

    const winner = valid[0];
    if (!winner) return { candidateId: null, direction: intended, assisted: false };
    return { candidateId: winner.candidate.id, direction: winner.direction, assisted: true };
}

export function resolveAttackAim(
    directDirection: { x: number; z: number } | null,
    origin: { x: number; z: number },
    intendedDirection: { x: number; z: number },
    candidates: readonly AimCandidate2D[]
): AimSelection {
    if (directDirection) {
        const length = Math.hypot(directDirection.x, directDirection.z);
        if (length > 0) {
            return {
                candidateId: null,
                direction: { x: directDirection.x / length, z: directDirection.z / length },
                assisted: false
            };
        }
    }
    return selectSoftAimTarget(origin, intendedDirection, candidates);
}
