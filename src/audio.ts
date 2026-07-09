export class AudioManager {
    private ctx: AudioContext;
    private buffers: Map<string, AudioBuffer> = new Map();
    private tracks: Map<string, { source: AudioBufferSourceNode, gain: GainNode }> = new Map();
    private initialized = false;

    constructor() {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    public async init() {
        if (this.initialized) return;
        await this.ctx.resume();
        this.initialized = true;
    }

    // Carrega todos os áudios necessários
    public async loadAll() {
        const files = [
            { id: 'phonk', url: '/audio/phonk.mp3' },
            { id: 'samba', url: '/audio/samba.mp3' },
            { id: 'forro', url: '/audio/forro.mp3' },
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

        // Prepara as tracks de música em loop, inicialmente silenciadas
        this.setupTrack('phonk');
        this.setupTrack('samba');
        this.setupTrack('forro');
    }

    private setupTrack(id: string) {
        const buffer = this.buffers.get(id);
        if (!buffer) return;

        const gainNode = this.ctx.createGain();
        gainNode.gain.value = 0; // Começa no volume zero
        gainNode.connect(this.ctx.destination);

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(gainNode);
        source.start(0);

        this.tracks.set(id, { source, gain: gainNode });
    }

    public crossfade(fromId: string | null, toId: string, duration = 0.2) {
        const now = this.ctx.currentTime;

        // Fade out da track atual (se existir)
        if (fromId && this.tracks.has(fromId)) {
            const fromGain = this.tracks.get(fromId)!.gain;
            fromGain.gain.cancelScheduledValues(now);
            fromGain.gain.setValueAtTime(fromGain.gain.value, now);
            fromGain.gain.linearRampToValueAtTime(0, now + duration);
        }

        // Fade in da nova track
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
            source.connect(this.ctx.destination);
            source.start(now); // Toca imediatamente
        }

        if (stingerBuffer) {
            const source = this.ctx.createBufferSource();
            source.buffer = stingerBuffer;
            source.connect(this.ctx.destination);
            // Atrasa levemente o stinger para sobrepor o fim do ruído estático
            source.start(now + 0.1); 
        }
    }
}