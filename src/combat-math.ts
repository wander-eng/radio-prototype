export type EnergyHitType = 'basic' | 'special';

const MAX_ENERGY = 100;
const TRANSFORMATION_DURATION_SECONDS = 15;
const ENERGY_GAIN_PER_ATTACK = 2;

export interface DamageApplication {
    hp: number;
    damageApplied: number;
    killed: boolean;
}

export interface IncomingDamageDecision extends DamageApplication {
    ignoredByInvulnerability: boolean;
}

export type PlayerAttackOutcome =
    | 'damage-applied'
    | 'ignored-global-invulnerability'
    | 'dodged-samba'
    | 'ignored-dead'
    | 'ignored-invalid';

export interface PlayerAttackDecision extends DamageApplication {
    outcome: PlayerAttackOutcome;
    ignoredByInvulnerability: boolean;
    dodgedBySamba: boolean;
    threatConsumed: boolean;
}

export function applyDamageToHp(
    currentHp: number,
    damage: number,
    maxHp: number = 100
): DamageApplication {
    const safeMaxHp = Math.max(0, maxHp);
    const clampedHp = Math.min(safeMaxHp, Math.max(0, currentHp));
    const safeDamage = Math.max(0, damage);
    const damageApplied = Math.min(clampedHp, safeDamage);
    const hp = clampedHp - damageApplied;

    return {
        hp,
        damageApplied,
        killed: clampedHp > 0 && hp === 0
    };
}

export function resolveIncomingDamage(
    currentHp: number,
    damage: number,
    maxHp: number,
    invulnerable: boolean
): IncomingDamageDecision {
    if (invulnerable) {
        const hp = Math.min(Math.max(0, maxHp), Math.max(0, currentHp));
        return {
            hp,
            damageApplied: 0,
            killed: false,
            ignoredByInvulnerability: true
        };
    }

    return {
        ...applyDamageToHp(currentHp, damage, maxHp),
        ignoredByInvulnerability: false
    };
}

export function resolvePlayerAttack(
    currentHp: number,
    damage: number,
    maxHp: number,
    state: {
        dead: boolean;
        globallyInvulnerable: boolean;
        sambaDodgeActive: boolean;
    }
): PlayerAttackDecision {
    const hp = Math.min(Math.max(0, maxHp), Math.max(0, currentHp));
    const ignored = (outcome: PlayerAttackOutcome, threatConsumed: boolean): PlayerAttackDecision => ({
        hp,
        damageApplied: 0,
        killed: false,
        outcome,
        ignoredByInvulnerability: outcome === 'ignored-global-invulnerability',
        dodgedBySamba: outcome === 'dodged-samba',
        threatConsumed
    });

    if (state.dead) return ignored('ignored-dead', false);
    if (damage <= 0) return ignored('ignored-invalid', false);
    if (state.globallyInvulnerable) return ignored('ignored-global-invulnerability', true);
    if (state.sambaDodgeActive) return ignored('dodged-samba', true);

    return {
        ...applyDamageToHp(hp, damage, maxHp),
        outcome: 'damage-applied',
        ignoredByInvulnerability: false,
        dodgedBySamba: false,
        threatConsumed: true
    };
}

export function updateInvulnerabilityTimer(current: number, deltaSeconds: number): number {
    const remaining = Math.max(0, current - Math.max(0, deltaSeconds));
    return remaining <= Number.EPSILON * 16 ? 0 : remaining;
}

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
