export class AudioManager {
    private ctx: AudioContext;
    private buffers: Map<string, AudioBuffer> = new Map();
    private tracks: Map<string, { source: AudioBufferSourceNode, gain: GainNode }> = new Map();
    private initialized = false;

    public musicGain: GainNode;
    public sfxGain: GainNode;

    constructor() {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        this.musicGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        
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
        ['phonk', 'samba', 'forro'].forEach(id => {
            const buffer = this.buffers.get(id);
            if (buffer) {
                const source = this.ctx.createBufferSource();
                source.buffer = buffer;
                source.loop = true;
                
                const gain = this.ctx.createGain();
                gain.gain.value = 0; 
                
                source.connect(gain);
                gain.connect(this.musicGain); 
                source.start(0);
                
                this.tracks.set(id, { source, gain });
            }
        });
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
        this.musicGain.gain.value = value;
    }

    public setSfxVolume(value: number) {
        this.sfxGain.gain.value = value;
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
}