import type { ImpactEvent, ImpactKind, ImpactStation } from './impact-event';

export const TRANSFORMED_IMPACT_PRESENCE = 1.2;

export type ImpactPresetName = 'fallback' | 'phonk' | 'samba' | 'forro';
export type ImpactSparkShape = 'radial' | 'narrow' | 'fan';

export interface ImpactPreset {
    readonly id: string;
    readonly name: ImpactPresetName;
    readonly station: ImpactStation;
    readonly kind: ImpactKind;
    readonly transformed: boolean;
    readonly presence: number;
    readonly spark: {
        readonly color: number;
        readonly shape: ImpactSparkShape;
        readonly spreadMultiplier: number;
        readonly forwardWeight: number;
        readonly verticalBias: number;
        readonly sizeMultiplier: number;
        readonly speedMultiplier: number;
        readonly lifetimeMultiplier: number;
    };
    readonly sound: {
        readonly pitchMultiplier: number;
        readonly durationMultiplier: number;
        readonly gainMultiplier: number;
        readonly bodyFilterMultiplier: number;
        readonly noiseFilterMultiplier: number;
        readonly attackSeconds: number;
        readonly pitchEndRatio: number;
        readonly waveform: OscillatorType;
        readonly bodyFilterType: BiquadFilterType;
        readonly noiseFilterType: BiquadFilterType;
    };
    readonly shake: {
        readonly amplitudeMultiplier: number;
        readonly durationMultiplier: number;
        readonly frequencyMultiplier: number;
        readonly axisX: number;
        readonly axisY: number;
        readonly axisZ: number;
    };
    readonly reaction: {
        readonly flashDurationMultiplier: number;
        readonly flashIntensityMultiplier: number;
        readonly knockbackMultiplier: number;
    };
    readonly hitstopMultiplier: number;
}

type StationPreset = Omit<
    ImpactPreset,
    'id' | 'station' | 'kind' | 'transformed' | 'presence'
>;

const STATION_PRESETS: Readonly<Record<ImpactPresetName, StationPreset>> = {
    fallback: {
        name: 'fallback',
        spark: {
            color: 0xffe85c,
            shape: 'radial',
            spreadMultiplier: 1,
            forwardWeight: 0.75,
            verticalBias: 0.45,
            sizeMultiplier: 1,
            speedMultiplier: 1,
            lifetimeMultiplier: 1
        },
        sound: {
            pitchMultiplier: 1,
            durationMultiplier: 1,
            gainMultiplier: 1,
            bodyFilterMultiplier: 1,
            noiseFilterMultiplier: 1,
            attackSeconds: 0.002,
            pitchEndRatio: 0.82,
            waveform: 'triangle',
            bodyFilterType: 'lowpass',
            noiseFilterType: 'bandpass'
        },
        shake: {
            amplitudeMultiplier: 1,
            durationMultiplier: 1,
            frequencyMultiplier: 1,
            axisX: 1,
            axisY: 0.45,
            axisZ: 0.6
        },
        reaction: {
            flashDurationMultiplier: 1,
            flashIntensityMultiplier: 1,
            knockbackMultiplier: 1
        },
        hitstopMultiplier: 1
    },
    phonk: {
        name: 'phonk',
        spark: {
            color: 0x39ff14,
            shape: 'radial',
            spreadMultiplier: 1.2,
            forwardWeight: 0.5,
            verticalBias: 0.5,
            sizeMultiplier: 1.1,
            speedMultiplier: 1.15,
            lifetimeMultiplier: 0.9
        },
        sound: {
            pitchMultiplier: 0.82,
            durationMultiplier: 0.88,
            gainMultiplier: 1,
            bodyFilterMultiplier: 0.82,
            noiseFilterMultiplier: 0.78,
            attackSeconds: 0.0012,
            pitchEndRatio: 0.72,
            waveform: 'triangle',
            bodyFilterType: 'lowpass',
            noiseFilterType: 'bandpass'
        },
        shake: {
            amplitudeMultiplier: 1.1,
            durationMultiplier: 0.9,
            frequencyMultiplier: 1.15,
            axisX: 1,
            axisY: 0.4,
            axisZ: 0.58
        },
        reaction: {
            flashDurationMultiplier: 0.95,
            flashIntensityMultiplier: 1.08,
            knockbackMultiplier: 1.08
        },
        hitstopMultiplier: 1.05
    },
    samba: {
        name: 'samba',
        spark: {
            color: 0xffd700,
            shape: 'narrow',
            spreadMultiplier: 0.55,
            forwardWeight: 1.3,
            verticalBias: 0.18,
            sizeMultiplier: 0.92,
            speedMultiplier: 1.15,
            lifetimeMultiplier: 0.82
        },
        sound: {
            pitchMultiplier: 1.18,
            durationMultiplier: 0.8,
            gainMultiplier: 0.98,
            bodyFilterMultiplier: 1.22,
            noiseFilterMultiplier: 1.28,
            attackSeconds: 0.0008,
            pitchEndRatio: 0.88,
            waveform: 'triangle',
            bodyFilterType: 'bandpass',
            noiseFilterType: 'highpass'
        },
        shake: {
            amplitudeMultiplier: 0.9,
            durationMultiplier: 0.85,
            frequencyMultiplier: 1.2,
            axisX: 0.52,
            axisY: 0.32,
            axisZ: 1
        },
        reaction: {
            flashDurationMultiplier: 0.85,
            flashIntensityMultiplier: 1.05,
            knockbackMultiplier: 0.95
        },
        hitstopMultiplier: 0.95
    },
    forro: {
        name: 'forro',
        spark: {
            color: 0xff7f27,
            shape: 'fan',
            spreadMultiplier: 0.95,
            forwardWeight: 0.72,
            verticalBias: 0.3,
            sizeMultiplier: 1.05,
            speedMultiplier: 0.96,
            lifetimeMultiplier: 1.15
        },
        sound: {
            pitchMultiplier: 0.95,
            durationMultiplier: 1.15,
            gainMultiplier: 1.03,
            bodyFilterMultiplier: 1.02,
            noiseFilterMultiplier: 1.08,
            attackSeconds: 0.0015,
            pitchEndRatio: 0.8,
            waveform: 'triangle',
            bodyFilterType: 'lowpass',
            noiseFilterType: 'bandpass'
        },
        shake: {
            amplitudeMultiplier: 1,
            durationMultiplier: 1.12,
            frequencyMultiplier: 0.85,
            axisX: 1,
            axisY: 0.38,
            axisZ: 1
        },
        reaction: {
            flashDurationMultiplier: 1.08,
            flashIntensityMultiplier: 1,
            knockbackMultiplier: 1
        },
        hitstopMultiplier: 1
    }
};

function presetNameForStation(station: ImpactStation): ImpactPresetName {
    return station ?? 'fallback';
}

function sparkColorForImpact(
    kind: ImpactKind,
    stationColor: number
): number {
    if (kind === 'player-damaged') return 0xff3030;
    if (kind === 'samba-dodge') return 0xffd700;
    if (kind === 'samba-counter') return 0xffffff;
    if (kind === 'enemy-kill') {
        if (stationColor === 0x39ff14) return 0xcaff7a;
        if (stationColor === 0xffd700) return 0xffffd2;
        if (stationColor === 0xff7f27) return 0xffbd66;
    }
    return stationColor;
}

export function selectImpactPreset(
    event: Pick<ImpactEvent, 'station' | 'kind' | 'transformed'>
): ImpactPreset {
    const name = presetNameForStation(event.station);
    const base = STATION_PRESETS[name];
    const presence = event.transformed ? TRANSFORMED_IMPACT_PRESENCE : 1;
    return Object.freeze({
        ...base,
        id: `${name}:${event.kind}:${event.transformed ? 'transformed' : 'base'}`,
        station: event.station,
        kind: event.kind,
        transformed: event.transformed,
        presence,
        spark: Object.freeze({
            ...base.spark,
            color: sparkColorForImpact(event.kind, base.spark.color)
        }),
        sound: Object.freeze({ ...base.sound }),
        shake: Object.freeze({
            ...base.shake,
            durationMultiplier: event.kind === 'player-damaged'
                ? 1
                : base.shake.durationMultiplier
        }),
        reaction: Object.freeze({ ...base.reaction })
    });
}
