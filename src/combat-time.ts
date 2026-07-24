import type { ImpactEvent, ImpactKind } from './impact-event';
import { selectImpactPreset } from './impact-presets';

export const SAMBA_SLOW_MOTION_DURATION_SECONDS = 0.15;
export const SAMBA_SLOW_MOTION_SCALE = 0.5;
export const MAX_HITSTOP_SECONDS = 0.075;
export const TRANSFORMED_HITSTOP_BONUS_SECONDS = 0.01;

const HITSTOP_SECONDS_BY_KIND: Readonly<Record<ImpactKind, number>> = {
    miss: 0,
    normal: 0.03,
    'phonk-strong': 0.045,
    'samba-counter': 0.05,
    'forro-multi': 0.045,
    'enemy-kill': 0.065,
    'player-damaged': 0.055,
    'samba-dodge': 0
};

export type ActiveTimeSource =
    | 'paused'
    | 'death'
    | 'hitstop'
    | 'samba-slow-motion';

export interface CombatTimeStep {
    readonly unscaledDeltaSeconds: number;
    readonly gameplayDeltaSeconds: number;
    readonly presentationDeltaSeconds: number;
    readonly effectiveTimeScale: number;
    readonly activeTimeSources: readonly ActiveTimeSource[];
}

export interface CombatTimeSnapshot {
    readonly hitstopActive: boolean;
    readonly hitstopRemaining: number;
    readonly sambaSlowMotionActive: boolean;
    readonly sambaSlowMotionRemaining: number;
    readonly effectiveTimeScale: number;
    readonly activeTimeSources: readonly ActiveTimeSource[];
}

export function hitstopDurationForImpact(
    event: Pick<ImpactEvent, 'kind' | 'station' | 'transformed' | 'targets'>
): number {
    const baseDuration = HITSTOP_SECONDS_BY_KIND[event.kind];
    if (baseDuration === 0) return 0;
    if (
        event.kind === 'player-damaged'
        && event.targets.some((target) => target.targetId === 'player' && target.killed)
    ) {
        return 0;
    }

    const preset = selectImpactPreset(event);
    const transformedBonus = event.transformed
        ? TRANSFORMED_HITSTOP_BONUS_SECONDS
        : 0;
    return Math.min(
        MAX_HITSTOP_SECONDS,
        baseDuration * preset.hitstopMultiplier + transformedBonus
    );
}

export class CombatTimeController {
    private hitstopTimer = 0;
    private sambaSlowMotionTimer = 0;
    private paused = false;
    private dead = false;
    private lastEffectiveTimeScale = 1;
    private lastActiveTimeSources: readonly ActiveTimeSource[] = Object.freeze([]);

    public requestHitstop(event: ImpactEvent): number {
        const requestedDuration = hitstopDurationForImpact(event);
        this.hitstopTimer = Math.max(this.hitstopTimer, requestedDuration);
        this.refreshObservableState();
        return requestedDuration;
    }

    public startSambaSlowMotion(
        durationSeconds: number = SAMBA_SLOW_MOTION_DURATION_SECONDS
    ) {
        this.sambaSlowMotionTimer = Math.max(
            this.sambaSlowMotionTimer,
            Math.max(0, durationSeconds)
        );
        this.refreshObservableState();
    }

    public setPaused(paused: boolean) {
        this.paused = paused;
        this.refreshObservableState();
    }

    public setDead(dead: boolean) {
        this.dead = dead;
        if (dead) this.clearTransientSources();
        this.refreshObservableState();
    }

    public clearTransientSources() {
        this.hitstopTimer = 0;
        this.sambaSlowMotionTimer = 0;
        this.refreshObservableState();
    }

    public reset() {
        this.hitstopTimer = 0;
        this.sambaSlowMotionTimer = 0;
        this.paused = false;
        this.dead = false;
        this.refreshObservableState();
    }

    public advance(unscaledDeltaSeconds: number): CombatTimeStep {
        const safeDelta = Math.max(0, unscaledDeltaSeconds);
        const activeTimeSources = this.currentActiveTimeSources();
        const effectiveTimeScale = this.currentEffectiveTimeScale();

        if (!this.paused && !this.dead) {
            this.hitstopTimer = Math.max(0, this.hitstopTimer - safeDelta);
            this.sambaSlowMotionTimer = Math.max(
                0,
                this.sambaSlowMotionTimer - safeDelta
            );
        }

        this.lastEffectiveTimeScale = effectiveTimeScale;
        this.lastActiveTimeSources = Object.freeze([...activeTimeSources]);

        return Object.freeze({
            unscaledDeltaSeconds: safeDelta,
            gameplayDeltaSeconds: safeDelta * effectiveTimeScale,
            presentationDeltaSeconds: safeDelta,
            effectiveTimeScale,
            activeTimeSources: this.lastActiveTimeSources
        });
    }

    public get snapshot(): CombatTimeSnapshot {
        return Object.freeze({
            hitstopActive: this.lastActiveTimeSources.includes('hitstop'),
            hitstopRemaining: this.hitstopTimer,
            sambaSlowMotionActive:
                this.sambaSlowMotionTimer > 0
                || this.lastActiveTimeSources.includes('samba-slow-motion'),
            sambaSlowMotionRemaining: this.sambaSlowMotionTimer,
            effectiveTimeScale: this.lastEffectiveTimeScale,
            activeTimeSources: this.lastActiveTimeSources
        });
    }

    private refreshObservableState() {
        this.lastEffectiveTimeScale = this.currentEffectiveTimeScale();
        this.lastActiveTimeSources = Object.freeze([
            ...this.currentActiveTimeSources()
        ]);
    }

    private currentEffectiveTimeScale(): number {
        if (this.paused || this.dead || this.hitstopTimer > 0) return 0;
        if (this.sambaSlowMotionTimer > 0) return SAMBA_SLOW_MOTION_SCALE;
        return 1;
    }

    private currentActiveTimeSources(): ActiveTimeSource[] {
        const sources: ActiveTimeSource[] = [];
        if (this.paused) sources.push('paused');
        if (this.dead) sources.push('death');
        if (this.hitstopTimer > 0) sources.push('hitstop');
        if (this.sambaSlowMotionTimer > 0) sources.push('samba-slow-motion');
        return sources;
    }
}
