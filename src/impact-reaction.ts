import type {
    ImpactEvent,
    ImpactKind,
    ImpactStation,
    ImpactTargetResult,
    ImpactVector3
} from './impact-event';
import { selectImpactPreset } from './impact-presets';

export const KNOCKBACK_DURATION_SECONDS = 0.08;
export const MAX_KNOCKBACK_DISTANCE = 1.1;
export const LETHAL_KNOCKBACK_MAX_DISTANCE = 0.6;

const FLASH_DURATION_SECONDS: Readonly<Record<ImpactKind, number>> = {
    miss: 0,
    normal: 0.08,
    'phonk-strong': 0.1,
    'samba-counter': 0.1,
    'forro-multi': 0.09,
    'enemy-kill': 0.12,
    'player-damaged': 0.12,
    'samba-dodge': 0.08
};

const FLASH_PRIORITY: Readonly<Record<ImpactKind, number>> = {
    miss: 0,
    normal: 1,
    'samba-dodge': 1,
    'phonk-strong': 2,
    'samba-counter': 2,
    'forro-multi': 2,
    'player-damaged': 2,
    'enemy-kill': 3
};

const FLASH_INTENSITY: Readonly<Record<ImpactKind, number>> = {
    miss: 0,
    normal: 0.55,
    'samba-dodge': 0.5,
    'phonk-strong': 0.8,
    'samba-counter': 0.8,
    'forro-multi': 0.75,
    'player-damaged': 0.85,
    'enemy-kill': 1
};

const KNOCKBACK_DISTANCE: Readonly<Record<ImpactKind, number>> = {
    miss: 0,
    normal: 0.65,
    'phonk-strong': 0.85,
    'samba-counter': 0.8,
    'forro-multi': 0.8,
    'enemy-kill': 0.6,
    'player-damaged': 0,
    'samba-dodge': 0
};

export interface ImpactReactionSnapshot {
    readonly flashActive: boolean;
    readonly flashKind: ImpactKind | null;
    readonly flashRemaining: number;
    readonly flashIntensity: number;
    readonly knockbackActive: boolean;
    readonly knockbackRemainingDistance: number;
}

export interface ImpactReactive {
    readonly impactReactionSnapshot: ImpactReactionSnapshot;
    applyImpactReaction(event: ImpactEvent, target: ImpactTargetResult): void;
    updateImpactReaction(
        presentationDeltaSeconds: number,
        gameplayDeltaSeconds: number
    ): ImpactVector3;
    resetImpactReaction(): void;
}

export function isImpactReactive(value: unknown): value is ImpactReactive {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<ImpactReactive>;
    return typeof candidate.applyImpactReaction === 'function'
        && typeof candidate.updateImpactReaction === 'function'
        && typeof candidate.resetImpactReaction === 'function';
}

export function flashDurationForImpact(
    kind: ImpactKind,
    station: ImpactStation = null
): number {
    const preset = selectImpactPreset({ kind, station, transformed: false });
    return FLASH_DURATION_SECONDS[kind]
        * preset.reaction.flashDurationMultiplier;
}

export function flashIntensityForImpact(
    kind: ImpactKind,
    station: ImpactStation = null,
    transformed: boolean = false
): number {
    const preset = selectImpactPreset({ kind, station, transformed });
    return Math.min(
        1,
        FLASH_INTENSITY[kind]
        * preset.reaction.flashIntensityMultiplier
        * preset.presence
    );
}

export function selectFlashKind(
    current: ImpactKind | null,
    incoming: ImpactKind
): ImpactKind {
    if (!current || FLASH_PRIORITY[incoming] >= FLASH_PRIORITY[current]) {
        return incoming;
    }
    return current;
}

export function normalizedDirectionXZ(direction: ImpactVector3): ImpactVector3 {
    const length = Math.hypot(direction.x, direction.z);
    if (length === 0) return { x: 0, y: 0, z: 0 };
    return {
        x: direction.x / length,
        y: 0,
        z: direction.z / length
    };
}

export function knockbackDistanceForImpact(
    kind: ImpactKind,
    transformed: boolean,
    station: ImpactStation = null
): number {
    const baseDistance = KNOCKBACK_DISTANCE[kind];
    if (baseDistance === 0) return 0;
    const preset = selectImpactPreset({ kind, station, transformed });
    const modifiedDistance = baseDistance
        * preset.reaction.knockbackMultiplier
        * preset.presence;
    const categoryLimit = kind === 'enemy-kill'
        ? LETHAL_KNOCKBACK_MAX_DISTANCE
        : MAX_KNOCKBACK_DISTANCE;
    return Math.min(categoryLimit, modifiedDistance);
}

export function easeOutQuadratic(progress: number): number {
    const clamped = Math.min(1, Math.max(0, progress));
    return 1 - (1 - clamped) ** 2;
}

export function clampReactionPosition(
    position: ImpactVector3,
    min: number = -12,
    max: number = 12
): ImpactVector3 {
    return {
        x: Math.min(max, Math.max(min, position.x)),
        y: position.y,
        z: Math.min(max, Math.max(min, position.z))
    };
}

export class LocalImpactReaction {
    private flashKind: ImpactKind | null = null;
    private flashRemaining = 0;
    private currentFlashIntensity = 0;
    private knockbackVector: ImpactVector3 = { x: 0, y: 0, z: 0 };
    private knockbackElapsed = 0;
    private knockbackAppliedProgress = 0;

    public trigger(
        event: Pick<ImpactEvent, 'kind' | 'direction' | 'transformed'>
            & { readonly station?: ImpactStation },
        allowKnockback: boolean
    ) {
        const station = event.station ?? null;
        const flashDuration = flashDurationForImpact(event.kind, station);
        if (flashDuration > 0) {
            const nextKind = selectFlashKind(this.flashKind, event.kind);
            if (nextKind === event.kind) {
                this.flashKind = nextKind;
                this.flashRemaining = flashDuration;
                this.currentFlashIntensity = flashIntensityForImpact(
                    event.kind,
                    station,
                    event.transformed
                );
            }
        }

        if (!allowKnockback) return;
        const distance = knockbackDistanceForImpact(
            event.kind,
            event.transformed,
            station
        );
        const direction = normalizedDirectionXZ(event.direction);
        if (distance === 0 || (direction.x === 0 && direction.z === 0)) return;

        const remainingScale = 1 - this.knockbackAppliedProgress;
        const combinedX = this.knockbackVector.x * remainingScale + direction.x * distance;
        const combinedZ = this.knockbackVector.z * remainingScale + direction.z * distance;
        const combinedLength = Math.hypot(combinedX, combinedZ);
        const distanceLimit = event.kind === 'enemy-kill'
            ? LETHAL_KNOCKBACK_MAX_DISTANCE
            : MAX_KNOCKBACK_DISTANCE;
        const clampScale = combinedLength > distanceLimit
            ? distanceLimit / combinedLength
            : 1;

        this.knockbackVector = {
            x: combinedX * clampScale,
            y: 0,
            z: combinedZ * clampScale
        };
        this.knockbackElapsed = 0;
        this.knockbackAppliedProgress = 0;
    }

    public update(
        presentationDeltaSeconds: number,
        gameplayDeltaSeconds: number
    ): ImpactVector3 {
        this.flashRemaining = Math.max(
            0,
            this.flashRemaining - Math.max(0, presentationDeltaSeconds)
        );
        if (this.flashRemaining === 0) {
            this.flashKind = null;
            this.currentFlashIntensity = 0;
        }

        if (!this.isKnockbackActive || gameplayDeltaSeconds <= 0) {
            return { x: 0, y: 0, z: 0 };
        }

        this.knockbackElapsed = Math.min(
            KNOCKBACK_DURATION_SECONDS,
            this.knockbackElapsed + Math.max(0, gameplayDeltaSeconds)
        );
        const nextProgress = easeOutQuadratic(
            this.knockbackElapsed / KNOCKBACK_DURATION_SECONDS
        );
        const progressDelta = nextProgress - this.knockbackAppliedProgress;
        this.knockbackAppliedProgress = nextProgress;
        const displacement = {
            x: this.knockbackVector.x * progressDelta,
            y: 0,
            z: this.knockbackVector.z * progressDelta
        };

        if (this.knockbackElapsed >= KNOCKBACK_DURATION_SECONDS) {
            this.knockbackVector = { x: 0, y: 0, z: 0 };
            this.knockbackElapsed = 0;
            this.knockbackAppliedProgress = 0;
        }
        return displacement;
    }

    public reset() {
        this.flashKind = null;
        this.flashRemaining = 0;
        this.currentFlashIntensity = 0;
        this.knockbackVector = { x: 0, y: 0, z: 0 };
        this.knockbackElapsed = 0;
        this.knockbackAppliedProgress = 0;
    }

    public get snapshot(): ImpactReactionSnapshot {
        const remainingScale = 1 - this.knockbackAppliedProgress;
        return Object.freeze({
            flashActive: this.flashKind !== null && this.flashRemaining > 0,
            flashKind: this.flashKind,
            flashRemaining: this.flashRemaining,
            flashIntensity: this.flashKind
                ? this.currentFlashIntensity
                : 0,
            knockbackActive: this.isKnockbackActive,
            knockbackRemainingDistance: Math.hypot(
                this.knockbackVector.x * remainingScale,
                this.knockbackVector.z * remainingScale
            )
        });
    }

    private get isKnockbackActive(): boolean {
        return Math.hypot(this.knockbackVector.x, this.knockbackVector.z) > 0;
    }
}
