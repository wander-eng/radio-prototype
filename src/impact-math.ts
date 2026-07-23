import type { PlayerAttackDecision } from './combat-math';
import { phonkDamageMultiplier } from './combat-math';
import type {
    ImpactContext,
    ImpactEvent,
    ImpactKind,
    ImpactSource,
    ImpactStation,
    ImpactTargetResult,
    ImpactVector3
} from './impact-event';
import { createImpactEvent } from './impact-event';

export interface OffensiveImpactClassification {
    readonly source: Extract<ImpactSource, 'basic-attack' | 'forro-dash'>;
    readonly station: ImpactStation;
    readonly targets: readonly ImpactTargetResult[];
    readonly phonkReachedDamageCap?: boolean;
    readonly sambaCounterConsumed?: boolean;
}

export interface PlayerAttackImpactInput {
    readonly actionId: number;
    readonly source: Extract<ImpactSource, 'melee' | 'projectile'>;
    readonly context: ImpactContext;
    readonly origin: ImpactVector3;
    readonly direction: ImpactVector3;
    readonly playerPosition: ImpactVector3;
    readonly result: PlayerAttackDecision;
}

export function phonkImpactReachesDamageCap(
    comboBeforeAction: number,
    successfulHitCount: number
): boolean {
    if (successfulHitCount <= 0) return false;
    const comboAfterAction = Math.max(0, comboBeforeAction) + 1;
    const maximumMultiplier = phonkDamageMultiplier(Number.MAX_SAFE_INTEGER);
    return phonkDamageMultiplier(comboAfterAction) >= maximumMultiplier;
}

export function classifyOffensiveImpact(
    input: OffensiveImpactClassification
): ImpactKind | null {
    const acceptedTargets = input.targets.filter((target) => target.damageAccepted > 0);

    if (acceptedTargets.length === 0) {
        return input.source === 'basic-attack' ? 'miss' : null;
    }
    if (acceptedTargets.some((target) => target.killed)) return 'enemy-kill';
    if (input.station === 'samba' && input.sambaCounterConsumed) return 'samba-counter';
    if (input.station === 'phonk' && input.phonkReachedDamageCap) return 'phonk-strong';
    if (input.station === 'forro' && acceptedTargets.length >= 2) return 'forro-multi';
    return 'normal';
}

export function classifyPlayerAttackImpact(
    result: PlayerAttackDecision
): Extract<ImpactKind, 'player-damaged' | 'samba-dodge'> | null {
    if (result.outcome === 'damage-applied' && result.damageApplied > 0) {
        return 'player-damaged';
    }
    if (result.outcome === 'dodged-samba') return 'samba-dodge';
    return null;
}

export function createPlayerAttackImpactEvent(
    input: PlayerAttackImpactInput
): ImpactEvent | null {
    const kind = classifyPlayerAttackImpact(input.result);
    if (!kind) return null;

    return createImpactEvent({
        actionId: input.actionId,
        kind,
        source: input.source,
        station: input.context.station,
        transformed: input.context.transformed,
        origin: input.origin,
        direction: input.direction,
        targets: [{
            targetId: 'player',
            position: input.playerPosition,
            damageAccepted: input.result.damageApplied,
            killed: input.result.killed
        }]
    });
}
