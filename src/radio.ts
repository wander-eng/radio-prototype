import type { Player } from './player';
import type { GameScene } from './scene';
import type { AudioManager } from './audio';
import type { EffectsManager } from './effects';

export const StationId = {
    PHONK: 1,
    SAMBA: 2,
    FORRO: 3
} as const;

export type StationId = typeof StationId[keyof typeof StationId];

export class RadioSystem {
    public currentStation: StationId | null = null;
    
    private player: Player;
    private gameScene: GameScene;
    private audioManager: AudioManager;
    private effectsManager: EffectsManager;
    
    constructor(
        player: Player,
        gameScene: GameScene,
        audioManager: AudioManager,
        effectsManager: EffectsManager
    ) {
        this.player = player;
        this.gameScene = gameScene;
        this.audioManager = audioManager;
        this.effectsManager = effectsManager;
    }

    public setStation(id: StationId, isInitialLoad = false) {
        if (this.currentStation === id) return;

        const prevStation = this.currentStation;
        this.currentStation = id;

        // 1. Aplica Identidade Visual Estática
        switch (id) {
            case StationId.PHONK:
                this.player.setEmissiveColor(0x39FF14);
                this.gameScene.setEnvironmentColor(0x0a1a0a, 0.08); 
                break;
            case StationId.SAMBA:
                this.player.setEmissiveColor(0xFFD700);
                this.gameScene.setEnvironmentColor(0xfff5e6, 0.01); 
                break;
            case StationId.FORRO:
                this.player.setEmissiveColor(0xFF7F27);
                this.gameScene.setEnvironmentColor(0x4a2511, 0.04); 
                break;
        }

        // 2. Aplica Áudio
        const getTrackName = (station: StationId) => {
            if (station === StationId.PHONK) return 'phonk';
            if (station === StationId.SAMBA) return 'samba';
            return 'forro';
        };

        const fromTrack = prevStation ? getTrackName(prevStation) : null;
        const toTrack = getTrackName(id);

        this.audioManager.crossfade(fromTrack, toTrack, 0.2);

        // 3. Efeitos Dinâmicos de Sintonia (Apenas no Gameplay)
        if (!isInitialLoad) {
            this.audioManager.playTuningSequence();
            this.effectsManager.playStationSwitchEffect(id, this.player.mesh.position);
        }
    }
}