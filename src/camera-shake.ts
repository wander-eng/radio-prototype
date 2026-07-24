import type { ImpactEvent, ImpactKind, ImpactVector3 } from './impact-event';
import { selectImpactPreset } from './impact-presets';

export const MAX_CAMERA_SHAKE_OFFSET = 0.1;
export const DEFAULT_SHAKE_STRENGTH = 1;

export interface CameraShakeProfile {
    readonly amplitude: number;
    readonly duration: number;
    readonly frequency: number;
    readonly axisX?: number;
    readonly axisY?: number;
    readonly axisZ?: number;
}

export interface CameraShakeImpulse extends CameraShakeProfile {
    readonly actionId: number;
    readonly phase: number;
    readonly elapsed: number;
}

export interface CameraShakeSnapshot {
    readonly active: boolean;
    readonly intensity: number;
    readonly activeImpulseCount: number;
    readonly shakeStrength: number;
}

const SHAKE_PROFILES: Readonly<Record<ImpactKind, CameraShakeProfile>> = {
    miss: { amplitude: 0, duration: 0, frequency: 0 },
    normal: { amplitude: 0.025, duration: 0.1, frequency: 30 },
    'phonk-strong': { amplitude: 0.045, duration: 0.12, frequency: 30 },
    'samba-counter': { amplitude: 0.035, duration: 0.1, frequency: 34 },
    'forro-multi': { amplitude: 0.05, duration: 0.13, frequency: 24 },
    'enemy-kill': { amplitude: 0.075, duration: 0.16, frequency: 20 },
    'player-damaged': { amplitude: 0.08, duration: 0.18, frequency: 16 },
    'samba-dodge': { amplitude: 0.02, duration: 0.08, frequency: 36 }
};

const ZERO_OFFSET: ImpactVector3 = Object.freeze({ x: 0, y: 0, z: 0 });

export function clampShakeStrength(value: number): number {
    if (Number.isNaN(value)) return 0;
    return Math.min(1, Math.max(0, value));
}

export function cameraShakeProfileForImpact(
    event: Pick<ImpactEvent, 'kind' | 'station' | 'transformed'>
): CameraShakeProfile {
    const profile = SHAKE_PROFILES[event.kind];
    const preset = selectImpactPreset(event);
    const transformedAmplitude = profile.amplitude
        * preset.shake.amplitudeMultiplier
        * preset.presence;
    return Object.freeze({
        amplitude: Math.min(MAX_CAMERA_SHAKE_OFFSET, transformedAmplitude),
        duration: profile.duration * preset.shake.durationMultiplier,
        frequency: profile.frequency * preset.shake.frequencyMultiplier,
        axisX: preset.shake.axisX,
        axisY: preset.shake.axisY,
        axisZ: preset.shake.axisZ
    });
}

export function shakeDecay(progress: number): number {
    const clamped = Math.min(1, Math.max(0, progress));
    return (1 - clamped) ** 2;
}

export function deterministicShakePhase(
    actionId: number,
    origin: ImpactVector3
): number {
    const seed = actionId * 2.399963229728653
        + origin.x * 0.754877666
        + origin.y * 0.569840296
        + origin.z * 0.438289237;
    const fullTurn = Math.PI * 2;
    return ((seed % fullTurn) + fullTurn) % fullTurn;
}

export function cameraShakeOffsetForImpulse(
    impulse: CameraShakeImpulse
): ImpactVector3 {
    if (
        impulse.amplitude <= 0
        || impulse.duration <= 0
        || impulse.elapsed >= impulse.duration
    ) {
        return ZERO_OFFSET;
    }

    const progress = impulse.elapsed / impulse.duration;
    const amplitude = impulse.amplitude * shakeDecay(progress);
    const oscillation = impulse.phase
        + impulse.elapsed * impulse.frequency * Math.PI * 2;
    const raw = {
        x: Math.sin(oscillation) * (impulse.axisX ?? 1),
        y: Math.sin(oscillation * 1.37 + 1.1) * (impulse.axisY ?? 0.45),
        z: Math.cos(oscillation * 0.83 + 0.7) * (impulse.axisZ ?? 0.6)
    };
    const length = Math.hypot(raw.x, raw.y, raw.z);
    if (length === 0) return ZERO_OFFSET;

    return {
        x: raw.x / length * amplitude,
        y: raw.y / length * amplitude,
        z: raw.z / length * amplitude
    };
}

export function sumAndClampShakeOffsets(
    offsets: readonly ImpactVector3[],
    shakeStrength: number = DEFAULT_SHAKE_STRENGTH
): ImpactVector3 {
    const strength = clampShakeStrength(shakeStrength);
    const sum = offsets.reduce((current, offset) => ({
        x: current.x + offset.x,
        y: current.y + offset.y,
        z: current.z + offset.z
    }), { x: 0, y: 0, z: 0 });
    const scaled = {
        x: sum.x * strength,
        y: sum.y * strength,
        z: sum.z * strength
    };
    const length = Math.hypot(scaled.x, scaled.y, scaled.z);
    if (length === 0) return ZERO_OFFSET;
    const clampScale = length > MAX_CAMERA_SHAKE_OFFSET
        ? MAX_CAMERA_SHAKE_OFFSET / length
        : 1;
    return {
        x: scaled.x * clampScale,
        y: scaled.y * clampScale,
        z: scaled.z * clampScale
    };
}

export class CameraShakeController {
    private impulses: CameraShakeImpulse[] = [];
    private strength = DEFAULT_SHAKE_STRENGTH;
    private paused = false;
    private currentOffset: ImpactVector3 = ZERO_OFFSET;

    public request(event: ImpactEvent): boolean {
        const profile = cameraShakeProfileForImpact(event);
        if (profile.amplitude === 0 || profile.duration === 0) return false;
        if (this.impulses.some(impulse => impulse.actionId === event.actionId)) {
            return false;
        }

        this.impulses.push(Object.freeze({
            actionId: event.actionId,
            amplitude: profile.amplitude,
            duration: profile.duration,
            frequency: profile.frequency,
            phase: deterministicShakePhase(event.actionId, event.origin),
            elapsed: 0
        }));
        return true;
    }

    public set shakeStrength(value: number) {
        this.strength = clampShakeStrength(value);
        if (this.strength === 0) this.currentOffset = ZERO_OFFSET;
    }

    public get shakeStrength(): number {
        return this.strength;
    }

    public setPaused(paused: boolean) {
        this.paused = paused;
        if (paused) this.currentOffset = ZERO_OFFSET;
    }

    public advance(presentationDeltaSeconds: number): ImpactVector3 {
        if (this.paused) {
            this.currentOffset = ZERO_OFFSET;
            return this.currentOffset;
        }

        const delta = Math.max(0, presentationDeltaSeconds);
        this.impulses = this.impulses
            .map(impulse => Object.freeze({
                ...impulse,
                elapsed: Math.min(impulse.duration, impulse.elapsed + delta)
            }))
            .filter(impulse => impulse.elapsed < impulse.duration);

        this.currentOffset = sumAndClampShakeOffsets(
            this.impulses.map(cameraShakeOffsetForImpulse),
            this.strength
        );
        return this.currentOffset;
    }

    public reset() {
        this.impulses = [];
        this.paused = false;
        this.currentOffset = ZERO_OFFSET;
    }

    public get snapshot(): CameraShakeSnapshot {
        return Object.freeze({
            active: this.impulses.length > 0,
            intensity: Math.hypot(
                this.currentOffset.x,
                this.currentOffset.y,
                this.currentOffset.z
            ),
            activeImpulseCount: this.impulses.length,
            shakeStrength: this.strength
        });
    }
}
