import type { ImpactEvent } from './impact-event';
import {
    soundProfileForImpact,
    voiceAdmission,
    type ImpactSoundProfile,
    type VoiceLimitEntry
} from './impact-feedback';

export const DEFAULT_MUSIC_VOLUME = 0.15;
export const DEFAULT_SFX_VOLUME = 1;

interface ActiveImpactVoice extends VoiceLimitEntry {
    readonly remainingInitial: number;
    remainingSeconds: number;
    readonly sources: AudioScheduledSourceNode[];
    readonly nodes: AudioNode[];
}

export class AudioManager {
    private ctx: AudioContext;
    private buffers: Map<string, AudioBuffer> = new Map();
    private tracks: Map<string, { source: AudioBufferSourceNode, gain: GainNode }> = new Map();
    private initialized = false;
    private impactVoices: ActiveImpactVoice[] = [];
    private nextImpactVoiceId = 0;
    private impactVoiceOrder = 0;

    public musicGain: GainNode;
    public sfxGain: GainNode;

    constructor(context?: AudioContext) {
        this.ctx = context ?? new (window.AudioContext || (window as any).webkitAudioContext)();
        
        this.musicGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain.gain.value = DEFAULT_MUSIC_VOLUME;
        this.sfxGain.gain.value = DEFAULT_SFX_VOLUME;
        
        this.musicGain.connect(this.ctx.destination);
        this.sfxGain.connect(this.ctx.destination);
    }

    public async init() {
        if (this.initialized) return;
        await this.ctx.resume();
        this.initialized = true;
    }

    public async loadAll() {
        const files = [
            { id: 'phonk', url: '/audio/phonk.mp3' },
            { id: 'samba', url: '/audio/samba.mp3' },
            { id: 'forro', url: '/audio/forro.mp3' },
            { id: 'phonk-transformation', url: '/audio/phonk-transformation.mp3' },
            { id: 'samba-transformation', url: '/audio/samba-transformation.mp3' },
            { id: 'forro-transformation', url: '/audio/forro-transformation.mp3' },
            { id: 'static', url: '/audio/static.mp3' },
            { id: 'stinger', url: '/audio/stinger.mp3' }
        ];

        const promises = files.map(async (file) => {
            const response = await fetch(file.url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            this.buffers.set(file.id, audioBuffer);
        });

        await Promise.all(promises);
        this.setupTracks();
    }

    private setupTracks() {
        ['phonk', 'samba', 'forro'].forEach(id => this.createLoopingTrack(id));
    }

    private createLoopingTrack(id: string) {
        const buffer = this.buffers.get(id);
        if (!buffer) return;

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const gain = this.ctx.createGain();
        gain.gain.value = 0;

        source.connect(gain);
        gain.connect(this.musicGain);
        source.start(0, 0);

        this.tracks.set(id, { source, gain });
    }

    public restartTrackFromBeginning(id: string) {
        this.stopTrack(id);
        this.createLoopingTrack(id);
    }

    public stopTrack(id: string, delay: number = 0) {
        const track = this.tracks.get(id);
        if (!track) return;

        track.source.stop(this.ctx.currentTime + Math.max(0, delay));
        this.tracks.delete(id);
    }

    public crossfade(fromId: string | null, toId: string, duration: number = 0.2) {
        const now = this.ctx.currentTime;
        if (fromId && this.tracks.has(fromId)) {
            const fromGain = this.tracks.get(fromId)!.gain;
            fromGain.gain.cancelScheduledValues(now);
            fromGain.gain.setValueAtTime(fromGain.gain.value, now);
            fromGain.gain.linearRampToValueAtTime(0, now + duration);
        }
        if (this.tracks.has(toId)) {
            const toGain = this.tracks.get(toId)!.gain;
            toGain.gain.cancelScheduledValues(now);
            toGain.gain.setValueAtTime(toGain.gain.value, now);
            toGain.gain.linearRampToValueAtTime(1, now + duration);
        }
    }

    public playTuningSequence() {
        const staticBuffer = this.buffers.get('static');
        const stingerBuffer = this.buffers.get('stinger');
        const now = this.ctx.currentTime;

        if (staticBuffer) {
            const source = this.ctx.createBufferSource();
            source.buffer = staticBuffer;
            source.connect(this.sfxGain); 
            source.start(now);
        }

        if (stingerBuffer) {
            const source = this.ctx.createBufferSource();
            source.buffer = stingerBuffer;
            source.connect(this.sfxGain); 
            source.start(now);
        }
    }

    public setMusicVolume(value: number) {
        this.musicGain.gain.value = Math.max(0, value);
    }

    public setSfxVolume(value: number) {
        this.sfxGain.gain.value = value;
    }

    public playImpact(event: ImpactEvent): boolean {
        const profile = soundProfileForImpact(event);
        const candidate: VoiceLimitEntry = {
            id: this.nextImpactVoiceId + 1,
            kind: profile.kind,
            createdOrder: this.impactVoiceOrder + 1,
            protected: profile.protected
        };
        const admission = voiceAdmission(this.impactVoices, candidate);
        if (!admission.accepted) return false;
        if (admission.evictedId !== null) {
            this.removeImpactVoice(admission.evictedId);
        }

        const id = ++this.nextImpactVoiceId;
        const createdOrder = ++this.impactVoiceOrder;
        const nodes = this.createImpactVoiceNodes(profile);
        this.impactVoices.push({
            id,
            kind: profile.kind,
            createdOrder,
            protected: profile.protected,
            remainingInitial: profile.durationSeconds,
            remainingSeconds: profile.durationSeconds,
            sources: nodes.sources,
            nodes: nodes.nodes
        });
        return true;
    }

    public updateImpactVoices(presentationDeltaSeconds: number) {
        const delta = Math.max(0, presentationDeltaSeconds);
        for (let index = this.impactVoices.length - 1; index >= 0; index--) {
            const voice = this.impactVoices[index];
            voice.remainingSeconds = Math.max(0, voice.remainingSeconds - delta);
            if (voice.remainingSeconds === 0) this.removeImpactVoiceAt(index);
        }
    }

    public resetImpactVoices() {
        for (let index = this.impactVoices.length - 1; index >= 0; index--) {
            this.removeImpactVoiceAt(index);
        }
    }

    public get activeImpactVoiceCount(): number {
        return this.impactVoices.length;
    }

    // --- NOVO: Congela e Descongela o tempo do motor de áudio ---
    public pauseAudio() {
        if (this.ctx.state === 'running') {
            this.ctx.suspend();
        }
    }

    public resumeAudio() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    private createImpactVoiceNodes(
        profile: ImpactSoundProfile
    ): { sources: AudioScheduledSourceNode[]; nodes: AudioNode[] } {
        if (
            typeof this.ctx.createOscillator !== 'function'
            || typeof this.ctx.createBiquadFilter !== 'function'
        ) {
            return { sources: [], nodes: [] };
        }

        const now = this.ctx.currentTime;
        const oscillator = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const envelope = this.ctx.createGain();
        oscillator.type = profile.waveform;
        oscillator.frequency.setValueAtTime(profile.frequencyHz, now);
        oscillator.frequency.exponentialRampToValueAtTime(
            Math.max(32, profile.frequencyHz * profile.pitchEndRatio),
            now + profile.durationSeconds
        );
        filter.type = profile.bodyFilterType;
        filter.frequency.setValueAtTime(profile.bodyFilterHz, now);
        envelope.gain.setValueAtTime(0.0001, now);
        envelope.gain.exponentialRampToValueAtTime(
            Math.max(0.0001, profile.gain * profile.bodyGainMultiplier),
            now + profile.attackSeconds
        );
        envelope.gain.exponentialRampToValueAtTime(
            0.0001,
            now + profile.durationSeconds
        );
        oscillator.connect(filter);
        filter.connect(envelope);
        envelope.connect(this.sfxGain);
        oscillator.start(now);
        oscillator.stop(now + profile.durationSeconds);

        const sources: AudioScheduledSourceNode[] = [oscillator];
        const nodes: AudioNode[] = [oscillator, filter, envelope];
        const noise = this.createImpactNoise(profile, now);
        if (noise) {
            sources.push(noise.source);
            nodes.push(noise.source, noise.filter, noise.envelope);
        }
        return { sources, nodes };
    }

    private createImpactNoise(
        profile: ImpactSoundProfile,
        now: number
    ): {
        source: AudioBufferSourceNode;
        filter: BiquadFilterNode;
        envelope: GainNode;
    } | null {
        if (
            typeof this.ctx.createBuffer !== 'function'
            || typeof this.ctx.createBufferSource !== 'function'
        ) return null;

        const noiseDuration = Math.min(
            profile.durationSeconds,
            profile.kind === 'kill' || profile.kind === 'player-damaged'
                ? 0.15
                : profile.kind === 'multi' || profile.kind === 'strong'
                    ? 0.12
                    : 0.1
        );
        const frameCount = Math.max(
            1,
            Math.ceil(this.ctx.sampleRate * noiseDuration)
        );
        const buffer = this.ctx.createBuffer(1, frameCount, this.ctx.sampleRate);
        const channel = buffer.getChannelData(0);
        let noiseState = ((profile.variant + 1) * 0x9e3779b9) >>> 0;
        for (let index = 0; index < channel.length; index++) {
            noiseState ^= noiseState << 13;
            noiseState ^= noiseState >>> 17;
            noiseState ^= noiseState << 5;
            const whiteNoise = (noiseState >>> 0) / 0xffffffff * 2 - 1;
            const progress = index / channel.length;
            channel[index] = whiteNoise * (1 - progress) ** 1.35;
        }
        const source = this.ctx.createBufferSource();
        const filter = this.ctx.createBiquadFilter();
        const envelope = this.ctx.createGain();
        filter.type = profile.noiseFilterType;
        filter.frequency.setValueAtTime(profile.noiseFilterHz, now);
        envelope.gain.setValueAtTime(0.0001, now);
        envelope.gain.exponentialRampToValueAtTime(
            Math.max(
                0.0001,
                Math.min(0.3, profile.gain * profile.noiseGainMultiplier)
            ),
            now + Math.min(profile.attackSeconds, 0.0015)
        );
        envelope.gain.exponentialRampToValueAtTime(
            0.0001,
            now + noiseDuration
        );
        source.buffer = buffer;
        source.connect(filter);
        filter.connect(envelope);
        envelope.connect(this.sfxGain);
        source.start(now);
        source.stop(now + noiseDuration);
        return { source, filter, envelope };
    }

    private removeImpactVoice(id: number) {
        const index = this.impactVoices.findIndex(voice => voice.id === id);
        if (index >= 0) this.removeImpactVoiceAt(index);
    }

    private removeImpactVoiceAt(index: number) {
        const [voice] = this.impactVoices.splice(index, 1);
        if (!voice) return;
        voice.sources.forEach(source => {
            try {
                source.stop();
            } catch {
                // A fonte pode já ter encerrado pelo envelope agendado.
            }
        });
        voice.nodes.forEach(node => {
            try {
                node.disconnect();
            } catch {
                // Desconexão repetida é segura para o reset idempotente.
            }
        });
    }
}
