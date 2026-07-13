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