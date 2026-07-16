export type EnergyHitType = 'basic' | 'special';

const MAX_ENERGY = 100;
const TRANSFORMATION_DURATION_SECONDS = 15;
const ENERGY_GAIN_PER_ATTACK = 2;

export function energyGainForHit(_hitType: EnergyHitType): number {
    return ENERGY_GAIN_PER_ATTACK;
}

export function energyGainForAttack(successfulHitCount: number, transformed: boolean): number {
    if (transformed || successfulHitCount <= 0) return 0;
    return ENERGY_GAIN_PER_ATTACK;
}

export function clampEnergy(current: number, gain: number): number {
    return Math.min(MAX_ENERGY, Math.max(0, current + gain));
}

export function auraIntensity(energy: number): number {
    return Math.min(MAX_ENERGY, Math.max(0, energy)) / MAX_ENERGY;
}

export function auraIntensityForState(energy: number, transformed: boolean): number {
    return transformed ? 1 : auraIntensity(energy);
}

export function canTransform(energy: number): boolean {
    return energy >= MAX_ENERGY;
}

export function drainTransformationEnergy(current: number, deltaSeconds: number): number {
    const clampedCurrent = Math.min(MAX_ENERGY, Math.max(0, current));
    const safeDelta = Math.max(0, deltaSeconds);
    const drainPerSecond = MAX_ENERGY / TRANSFORMATION_DURATION_SECONDS;

    return Math.max(0, clampedCurrent - drainPerSecond * safeDelta);
}

export function phonkDamageMultiplier(comboCount: number): number {
    return 1 + Math.min(comboCount * 0.05, 0.30);
}

export function sambaDamage(baseDamage: number, isCounterAttack: boolean): number {
    return isCounterAttack ? baseDamage * 1.5 : baseDamage;
}

export function forroSweepHit(
    targetPos: { x: number; z: number },
    attackOrigin: { x: number; z: number },
    forward: { x: number; z: number },
    range: number = 2.4,
    radius: number = 1.5
): boolean {
    const hitCenterX = attackOrigin.x + forward.x * range;
    const hitCenterZ = attackOrigin.z + forward.z * range;
    
    const midPointX = attackOrigin.x + forward.x * (range * 0.5);
    const midPointZ = attackOrigin.z + forward.z * (range * 0.5);
    
    const distToCenter = Math.hypot(targetPos.x - hitCenterX, targetPos.z - hitCenterZ);
    const distToMid = Math.hypot(targetPos.x - midPointX, targetPos.z - midPointZ);
    
    return distToCenter <= radius || distToMid <= radius;
}
