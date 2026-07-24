import type {
    ImpactEvent,
    ImpactKind,
    ImpactTargetResult,
    ImpactVector3
} from './impact-event';
import {
    selectImpactPreset,
    type ImpactSparkShape
} from './impact-presets';

export const MAX_IMPACT_BURSTS = 12;
export const MAX_IMPACT_PARTICLES = 96;
export const MAX_IMPACT_VOICES = 8;

export type ImpactSoundKind =
    | 'swing'
    | 'normal'
    | 'strong'
    | 'multi'
    | 'kill'
    | 'player-damaged'
    | 'dodge';

export interface SparkBurstRequest {
    readonly actionId: number;
    readonly kind: ImpactKind;
    readonly position: ImpactVector3;
    readonly direction: ImpactVector3;
    readonly particleCount: number;
    readonly lifetimeSeconds: number;
    readonly priority: number;
    readonly pointSize: number;
    readonly speedMin: number;
    readonly speedMax: number;
    readonly spread: number;
    readonly presetId: string;
    readonly color: number;
    readonly shape: ImpactSparkShape;
    readonly forwardWeight: number;
    readonly verticalBias: number;
}

export interface BurstLimitEntry {
    readonly id: number;
    readonly kind: ImpactKind;
    readonly particleCount: number;
    readonly createdOrder: number;
}

export interface BurstAdmission {
    readonly accepted: boolean;
    readonly evictedIds: readonly number[];
}

export interface ImpactSoundProfile {
    readonly kind: ImpactSoundKind;
    readonly durationSeconds: number;
    readonly frequencyHz: number;
    readonly gain: number;
    readonly priority: number;
    readonly protected: boolean;
    readonly variant: number;
    readonly presetId: string;
    readonly waveform: OscillatorType;
    readonly bodyFilterType: BiquadFilterType;
    readonly noiseFilterType: BiquadFilterType;
    readonly bodyFilterHz: number;
    readonly noiseFilterHz: number;
    readonly bodyGainMultiplier: number;
    readonly noiseGainMultiplier: number;
    readonly attackSeconds: number;
    readonly pitchEndRatio: number;
}

export interface VoiceLimitEntry {
    readonly id: number;
    readonly kind: ImpactSoundKind;
    readonly createdOrder: number;
    readonly protected: boolean;
}

export interface VoiceAdmission {
    readonly accepted: boolean;
    readonly evictedId: number | null;
}

type BaseImpactSoundProfile = Pick<
    ImpactSoundProfile,
    'kind' | 'durationSeconds' | 'frequencyHz' | 'gain' | 'priority' | 'protected'
>;

const SPARK_COUNT: Readonly<Record<ImpactKind, number>> = {
    miss: 0,
    normal: 6,
    'phonk-strong': 10,
    'samba-counter': 8,
    'forro-multi': 4,
    'enemy-kill': 14,
    'player-damaged': 6,
    'samba-dodge': 6
};

const SPARK_LIFETIME: Readonly<Record<ImpactKind, number>> = {
    miss: 0,
    normal: 0.22,
    'phonk-strong': 0.25,
    'samba-counter': 0.23,
    'forro-multi': 0.24,
    'enemy-kill': 0.26,
    'player-damaged': 0.26,
    'samba-dodge': 0.2
};

const SPARK_POINT_SIZE: Readonly<Record<ImpactKind, number>> = {
    miss: 0,
    normal: 0.22,
    'phonk-strong': 0.32,
    'samba-counter': 0.29,
    'forro-multi': 0.25,
    'enemy-kill': 0.4,
    'player-damaged': 0.36,
    'samba-dodge': 0.25
};

const SPARK_SPEED: Readonly<Record<ImpactKind, readonly [number, number]>> = {
    miss: [0, 0],
    normal: [5, 8],
    'phonk-strong': [7.5, 12],
    'samba-counter': [6.5, 10.5],
    'forro-multi': [5.5, 9],
    'enemy-kill': [8.5, 13.5],
    'player-damaged': [7.5, 12.5],
    'samba-dodge': [5.5, 9]
};

const SPARK_SPREAD: Readonly<Record<ImpactKind, number>> = {
    miss: 0,
    normal: 1.15,
    'phonk-strong': 1.55,
    'samba-counter': 1.25,
    'forro-multi': 1.6,
    'enemy-kill': 1.9,
    'player-damaged': 1.65,
    'samba-dodge': 1.35
};

const SPARK_PRIORITY: Readonly<Record<ImpactKind, number>> = {
    miss: 0,
    normal: 1,
    'samba-dodge': 1,
    'phonk-strong': 2,
    'samba-counter': 2,
    'forro-multi': 2,
    'enemy-kill': 3,
    'player-damaged': 3
};

function scaledParticleCount(
    count: number,
    presence: number,
    perActionLimit: number = MAX_IMPACT_PARTICLES
): number {
    const scaled = Math.ceil(count * presence);
    return Math.min(perActionLimit, scaled);
}

function targetPosition(
    event: Pick<ImpactEvent, 'origin' | 'direction'>,
    target?: ImpactTargetResult
): ImpactVector3 {
    const position = target ? target.position : event.origin;
    const horizontalLength = Math.hypot(event.direction.x, event.direction.z);
    const facingX = horizontalLength > Number.EPSILON
        ? event.direction.x / horizontalLength
        : 0;
    const facingZ = horizontalLength > Number.EPSILON
        ? event.direction.z / horizontalLength
        : 0;
    return {
        x: position.x - facingX * 0.62,
        y: position.y + 0.55,
        z: position.z - facingZ * 0.62
    };
}

export function sparkRequestsForImpact(event: ImpactEvent): readonly SparkBurstRequest[] {
    if (event.kind === 'miss' || event.targets.length === 0) return Object.freeze([]);
    const preset = selectImpactPreset(event);

    const requestTuning = {
        presetId: preset.id,
        color: preset.spark.color,
        shape: preset.spark.shape,
        forwardWeight: preset.spark.forwardWeight,
        verticalBias: preset.spark.verticalBias
    };
    const lifetimeSeconds = Math.min(
        0.26,
        Math.max(
            0.12,
            SPARK_LIFETIME[event.kind] * preset.spark.lifetimeMultiplier
        )
    );

    if (event.kind === 'forro-multi') {
        const baseTotal = Math.min(12, SPARK_COUNT[event.kind] * event.targets.length);
        const total = scaledParticleCount(baseTotal, preset.presence, 12);
        const basePerTarget = Math.floor(total / event.targets.length);
        let remainder = total % event.targets.length;
        return Object.freeze(event.targets.map((target) => Object.freeze({
            actionId: event.actionId,
            kind: event.kind,
            position: Object.freeze(targetPosition(event, target)),
            direction: Object.freeze({ ...event.direction }),
            particleCount: basePerTarget + (remainder-- > 0 ? 1 : 0),
            lifetimeSeconds,
            priority: SPARK_PRIORITY[event.kind],
            pointSize:
                SPARK_POINT_SIZE[event.kind] * preset.spark.sizeMultiplier
                * preset.presence,
            speedMin:
                SPARK_SPEED[event.kind][0] * preset.spark.speedMultiplier,
            speedMax:
                SPARK_SPEED[event.kind][1] * preset.spark.speedMultiplier,
            spread:
                SPARK_SPREAD[event.kind] * preset.spark.spreadMultiplier,
            ...requestTuning
        })));
    }

    const representativeTarget = event.targets.find(target => target.killed)
        ?? event.targets[0];
    return Object.freeze([Object.freeze({
        actionId: event.actionId,
        kind: event.kind,
        position: Object.freeze(targetPosition(event, representativeTarget)),
        direction: Object.freeze({ ...event.direction }),
        particleCount: scaledParticleCount(
            SPARK_COUNT[event.kind],
            preset.presence
        ),
        lifetimeSeconds,
        priority: SPARK_PRIORITY[event.kind],
        pointSize:
            SPARK_POINT_SIZE[event.kind] * preset.spark.sizeMultiplier
            * preset.presence,
        speedMin:
            SPARK_SPEED[event.kind][0] * preset.spark.speedMultiplier,
        speedMax:
            SPARK_SPEED[event.kind][1] * preset.spark.speedMultiplier,
        spread:
            SPARK_SPREAD[event.kind] * preset.spark.spreadMultiplier,
        ...requestTuning
    })]);
}

export function burstAdmission(
    existing: readonly BurstLimitEntry[],
    incoming: Pick<BurstLimitEntry, 'kind' | 'particleCount'>
): BurstAdmission {
    const currentParticles = existing.reduce(
        (sum, burst) => sum + burst.particleCount,
        0
    );
    if (
        existing.length < MAX_IMPACT_BURSTS
        && currentParticles + incoming.particleCount <= MAX_IMPACT_PARTICLES
    ) {
        return Object.freeze({ accepted: true, evictedIds: Object.freeze([]) });
    }

    if (incoming.kind !== 'enemy-kill' && incoming.kind !== 'player-damaged') {
        return Object.freeze({ accepted: false, evictedIds: Object.freeze([]) });
    }

    const normalBursts = existing
        .filter(burst => burst.kind === 'normal')
        .sort((a, b) => a.createdOrder - b.createdOrder);
    const evictedIds: number[] = [];
    let remainingCount = existing.length;
    let remainingParticles = currentParticles;
    for (const burst of normalBursts) {
        if (
            remainingCount < MAX_IMPACT_BURSTS
            && remainingParticles + incoming.particleCount <= MAX_IMPACT_PARTICLES
        ) break;
        evictedIds.push(burst.id);
        remainingCount--;
        remainingParticles -= burst.particleCount;
    }

    const accepted = remainingCount < MAX_IMPACT_BURSTS
        && remainingParticles + incoming.particleCount <= MAX_IMPACT_PARTICLES;
    return Object.freeze({
        accepted,
        evictedIds: Object.freeze(accepted ? evictedIds : [])
    });
}

export function deterministicImpactVariant(actionId: number, variants: number = 3): number {
    const safeVariants = Math.max(1, Math.floor(variants));
    return Math.abs(Math.floor(actionId)) % safeVariants;
}

export function soundProfileForImpact(event: ImpactEvent): ImpactSoundProfile {
    const preset = selectImpactPreset(event);
    const variant = deterministicImpactVariant(event.actionId);
    const variantPitch = [0.97, 1, 1.03][variant];
    const profiles: Readonly<Record<ImpactKind, BaseImpactSoundProfile>> = {
        miss: {
            kind: 'swing', durationSeconds: 0.1, frequencyHz: 140,
            gain: 0.1, priority: 0, protected: false
        },
        normal: {
            kind: 'normal', durationSeconds: 0.13, frequencyHz: 125,
            gain: 0.22, priority: 1, protected: false
        },
        'phonk-strong': {
            kind: 'strong', durationSeconds: 0.16, frequencyHz: 85,
            gain: 0.3, priority: 2, protected: false
        },
        'samba-counter': {
            kind: 'strong', durationSeconds: 0.13, frequencyHz: 165,
            gain: 0.28, priority: 2, protected: false
        },
        'forro-multi': {
            kind: 'multi', durationSeconds: 0.17, frequencyHz: 105,
            gain: 0.31, priority: 2, protected: false
        },
        'enemy-kill': {
            kind: 'kill', durationSeconds: 0.22, frequencyHz: 75,
            gain: 0.36, priority: 3, protected: true
        },
        'player-damaged': {
            kind: 'player-damaged', durationSeconds: 0.23, frequencyHz: 65,
            gain: 0.38, priority: 3, protected: true
        },
        'samba-dodge': {
            kind: 'dodge', durationSeconds: 0.12, frequencyHz: 240,
            gain: 0.15, priority: 1, protected: false
        }
    };
    const profile = profiles[event.kind];
    const bodyFilterHz = bodyFilterFrequency(profile.kind)
        * preset.sound.bodyFilterMultiplier;
    const noiseFilterHz = noiseFilterFrequency(profile.kind)
        * preset.sound.noiseFilterMultiplier;
    return Object.freeze({
        ...profile,
        durationSeconds:
            profile.durationSeconds * preset.sound.durationMultiplier,
        frequencyHz:
            profile.frequencyHz * variantPitch * preset.sound.pitchMultiplier,
        gain: Math.min(
            0.44,
            profile.gain * preset.sound.gainMultiplier * preset.presence
        ),
        variant,
        presetId: preset.id,
        waveform: preset.sound.waveform,
        bodyFilterType: preset.sound.bodyFilterType,
        noiseFilterType: preset.sound.noiseFilterType,
        bodyFilterHz,
        noiseFilterHz,
        bodyGainMultiplier: bodyGainMultiplier(profile.kind),
        noiseGainMultiplier: noiseGainMultiplier(profile.kind),
        attackSeconds: preset.sound.attackSeconds,
        pitchEndRatio: preset.sound.pitchEndRatio
    });
}

function bodyGainMultiplier(kind: ImpactSoundKind): number {
    if (kind === 'swing') return 0.22;
    if (kind === 'dodge') return 0.35;
    if (kind === 'kill' || kind === 'player-damaged') return 0.5;
    return 0.55;
}

function noiseGainMultiplier(kind: ImpactSoundKind): number {
    if (kind === 'swing') return 0.75;
    if (kind === 'dodge') return 0.8;
    if (kind === 'normal') return 0.9;
    return 1;
}

function noiseFilterFrequency(kind: ImpactSoundKind): number {
    if (kind === 'swing') return 1250;
    if (kind === 'dodge') return 1550;
    if (kind === 'normal') return 760;
    if (kind === 'strong') return 540;
    if (kind === 'multi') return 620;
    if (kind === 'kill') return 440;
    return 360;
}

function bodyFilterFrequency(kind: ImpactSoundKind): number {
    if (kind === 'swing') return 1100;
    if (kind === 'dodge') return 1350;
    if (kind === 'normal') return 1000;
    if (kind === 'strong') return 850;
    if (kind === 'multi') return 900;
    if (kind === 'kill') return 760;
    return 680;
}

export function voiceAdmission(
    existing: readonly VoiceLimitEntry[],
    incoming: Pick<VoiceLimitEntry, 'kind' | 'protected'>
): VoiceAdmission {
    if (existing.length < MAX_IMPACT_VOICES) {
        return Object.freeze({ accepted: true, evictedId: null });
    }
    if (incoming.kind === 'swing') {
        return Object.freeze({ accepted: false, evictedId: null });
    }

    const replaceable = existing
        .filter(voice =>
            !voice.protected
            && (voice.kind === 'normal' || voice.kind === 'swing')
        )
        .sort((a, b) => a.createdOrder - b.createdOrder)[0];
    return Object.freeze({
        accepted: Boolean(replaceable),
        evictedId: replaceable?.id ?? null
    });
}
