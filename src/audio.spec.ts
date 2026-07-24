import { describe, expect, it, vi } from 'vitest';
import {
    AudioManager,
    DEFAULT_MUSIC_VOLUME,
    DEFAULT_SFX_VOLUME
} from './audio';
import { createImpactEvent, type ImpactKind } from './impact-event';
import { soundProfileForImpact } from './impact-feedback';

describe('AudioManager restartTrackFromBeginning', () => {
    it('para a instância anterior e inicia uma única nova fonte em 00:00', () => {
        const sources: Array<{ start: ReturnType<typeof vi.fn>, stop: ReturnType<typeof vi.fn> }> = [];
        const context = {
            currentTime: 10,
            destination: {},
            createGain: () => ({
                gain: {
                    value: 0,
                    cancelScheduledValues: vi.fn(),
                    setValueAtTime: vi.fn(),
                    linearRampToValueAtTime: vi.fn()
                },
                connect: vi.fn()
            }),
            createBufferSource: () => {
                const source = {
                    buffer: null,
                    loop: false,
                    connect: vi.fn(),
                    start: vi.fn(),
                    stop: vi.fn()
                };
                sources.push(source);
                return source;
            }
        } as unknown as AudioContext;
        const manager = new AudioManager(context);
        (manager as unknown as { buffers: Map<string, AudioBuffer> }).buffers.set(
            'phonk-transformation',
            {} as AudioBuffer
        );

        manager.restartTrackFromBeginning('phonk-transformation');
        manager.restartTrackFromBeginning('phonk-transformation');

        expect(sources).toHaveLength(2);
        expect(sources[0].stop).toHaveBeenCalledWith(10);
        expect(sources[1].start).toHaveBeenCalledWith(0, 0);
    });
});

function impactEvent(kind: ImpactKind, actionId: number = 1) {
    return createImpactEvent({
        actionId,
        kind,
        source: 'basic-attack',
        station: 'phonk',
        transformed: false,
        origin: { x: 0, y: 1, z: 0 },
        direction: { x: 1, y: 0, z: 0 },
        targets: kind === 'miss' ? [] : [{
            targetId: kind === 'player-damaged' ? 'player' : 'target',
            position: { x: 1, y: 1, z: 0 },
            damageAccepted: 10,
            killed: kind === 'enemy-kill'
        }]
    });
}

function createImpactAudioContext() {
    const scheduledSources: Array<{
        start: ReturnType<typeof vi.fn>;
        stop: ReturnType<typeof vi.fn>;
        disconnect: ReturnType<typeof vi.fn>;
    }> = [];
    const gainNodes: Array<{
        gain: {
            value: number;
            cancelScheduledValues: ReturnType<typeof vi.fn>;
            setValueAtTime: ReturnType<typeof vi.fn>;
            linearRampToValueAtTime: ReturnType<typeof vi.fn>;
            exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
        };
        connect: ReturnType<typeof vi.fn>;
        disconnect: ReturnType<typeof vi.fn>;
    }> = [];
    const oscillators: Array<{
        type: OscillatorType;
        frequency: {
            setValueAtTime: ReturnType<typeof vi.fn>;
            exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
        };
    }> = [];
    const createGain = () => {
        const node = {
            gain: {
                value: 1,
                cancelScheduledValues: vi.fn(),
                setValueAtTime: vi.fn(),
                linearRampToValueAtTime: vi.fn(),
                exponentialRampToValueAtTime: vi.fn()
            },
            connect: vi.fn(),
            disconnect: vi.fn()
        };
        gainNodes.push(node);
        return node;
    };
    const createSource = () => {
        const source = {
            connect: vi.fn(),
            disconnect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn()
        };
        scheduledSources.push(source);
        return source;
    };
    const context = {
        currentTime: 2,
        sampleRate: 1000,
        state: 'running',
        destination: {},
        createGain,
        createOscillator: () => {
            const oscillator = {
                ...createSource(),
                type: 'sine' as OscillatorType,
                frequency: {
                    setValueAtTime: vi.fn(),
                    exponentialRampToValueAtTime: vi.fn()
                }
            };
            oscillators.push(oscillator);
            return oscillator;
        },
        createBiquadFilter: () => ({
            type: 'lowpass',
            frequency: { setValueAtTime: vi.fn() },
            connect: vi.fn(),
            disconnect: vi.fn()
        }),
        createBuffer: (_channels: number, length: number) => ({
            getChannelData: () => new Float32Array(length)
        }),
        createBufferSource: () => ({
            ...createSource(),
            buffer: null,
            loop: false
        }),
        suspend: vi.fn(),
        resume: vi.fn()
    } as unknown as AudioContext;
    return { context, scheduledSources, gainNodes, oscillators };
}

describe('AudioManager impact voices', () => {
    it('sintetiza na árvore sfx existente e expira pelo delta de apresentação', () => {
        const { context, scheduledSources, gainNodes } = createImpactAudioContext();
        const manager = new AudioManager(context);

        expect(manager.playImpact(impactEvent('normal'))).toBe(true);
        expect(manager.activeImpactVoiceCount).toBe(1);
        expect(gainNodes.some(node => node.connect.mock.calls.some(
            ([destination]) => destination === manager.sfxGain
        ))).toBe(true);

        manager.updateImpactVoices(0.14);
        expect(manager.activeImpactVoiceCount).toBe(0);
        expect(scheduledSources.some(source => source.disconnect.mock.calls.length > 0)).toBe(true);
    });

    it('reset encerra vozes e pode ser repetido', () => {
        const { context, scheduledSources } = createImpactAudioContext();
        const manager = new AudioManager(context);
        manager.playImpact(impactEvent('enemy-kill'));
        manager.playImpact(impactEvent('player-damaged', 2));

        manager.resetImpactVoices();
        manager.resetImpactVoices();

        expect(manager.activeImpactVoiceCount).toBe(0);
        expect(scheduledSources.every(source => source.stop.mock.calls.length > 0)).toBe(true);
    });

    it('mantém no máximo oito vozes e rejeita swing sem cortar críticas', () => {
        const { context } = createImpactAudioContext();
        const manager = new AudioManager(context);
        for (let actionId = 1; actionId <= 8; actionId++) {
            manager.playImpact(impactEvent(
                actionId % 2 === 0 ? 'enemy-kill' : 'player-damaged',
                actionId
            ));
        }

        expect(manager.playImpact(impactEvent('miss', 9))).toBe(false);
        expect(manager.activeImpactVoiceCount).toBe(8);
    });

    it('inicia música em 15% e SFX em 100% de forma independente', () => {
        const { context } = createImpactAudioContext();
        const manager = new AudioManager(context);
        expect(DEFAULT_MUSIC_VOLUME).toBe(0.15);
        expect(DEFAULT_SFX_VOLUME).toBe(1);
        expect(manager.musicGain.gain.value).toBe(DEFAULT_MUSIC_VOLUME);
        expect(manager.sfxGain.gain.value).toBe(DEFAULT_SFX_VOLUME);
    });

    it('alterações manuais preservam controles independentes', () => {
        const { context } = createImpactAudioContext();
        const manager = new AudioManager(context);
        manager.setMusicVolume(0.4);
        expect(manager.musicGain.gain.value).toBe(0.4);
        expect(manager.sfxGain.gain.value).toBe(1);
        manager.setSfxVolume(0.65);
        expect(manager.musicGain.gain.value).toBe(0.4);
        expect(manager.sfxGain.gain.value).toBe(0.65);
    });

    it('pausa e reset de impactos não restauram volumes antigos', () => {
        const { context } = createImpactAudioContext();
        const manager = new AudioManager(context);
        manager.setMusicVolume(0.35);
        manager.setSfxVolume(0.7);
        manager.pauseAudio();
        manager.resetImpactVoices();
        manager.resumeAudio();
        expect(manager.musicGain.gain.value).toBe(0.35);
        expect(manager.sfxGain.gain.value).toBe(0.7);
    });

    it.each(['phonk', 'samba', 'forro'] as const)(
        'uses the resolved %s sound preset in the shared audio graph',
        (station) => {
            const { context, oscillators } = createImpactAudioContext();
            const manager = new AudioManager(context);
            const event = createImpactEvent({
                ...impactEvent('normal', 30),
                station
            });
            const expected = soundProfileForImpact(event);
            manager.playImpact(event);
            expect(oscillators).toHaveLength(1);
            expect(oscillators[0].type).toBe(expected.waveform);
            expect(oscillators[0].frequency.setValueAtTime)
                .toHaveBeenCalledWith(expected.frequencyHz, 2);
        }
    );
});
