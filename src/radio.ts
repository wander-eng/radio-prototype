import type { Player } from './player';
import type { GameScene } from './scene';
import type { AudioManager } from './audio';

// 1. Substituímos o 'enum' por um objeto JS constante (permitido pela regra)
export const StationId = {
    PHONK: 1,
    SAMBA: 2,
    FORRO: 3
} as const;

// 2. Extraímos o tipo dele para podermos usar como tipagem estrita
export type StationId = typeof StationId[keyof typeof StationId];

export class RadioSystem {
    public currentStation: StationId | null = null;
    
    private player: Player;
    private gameScene: GameScene;
    private audioManager: AudioManager;
    
    constructor(
        player: Player,
        gameScene: GameScene,
        audioManager: AudioManager
    ) {
        this.player = player;
        this.gameScene = gameScene;
        this.audioManager = audioManager;
    }

    public setStation(id: StationId, isInitialLoad = false) {
        if (this.currentStation === id) return;

        const prevStation = this.currentStation;
        this.currentStation = id;

        // 1. Aplica Identidade Visual (Cor emissive e Fog)
        switch (id) {
            case StationId.PHONK:
                this.player.setEmissiveColor(0x39FF14);
                this.gameScene.setEnvironmentColor(0x0a1a0a, 0.08); // Verde escuro, denso
                break;
            case StationId.SAMBA:
                this.player.setEmissiveColor(0xFFD700);
                this.gameScene.setEnvironmentColor(0xfff5e6, 0.01); // Claro, quase ausente
                break;
            case StationId.FORRO:
                this.player.setEmissiveColor(0xFF7F27);
                this.gameScene.setEnvironmentColor(0x4a2511, 0.04); // Laranja quente, médio
                break;
        }

        // 2. Aplica Áudio (Crossfade)
        const getTrackName = (station: StationId) => {
            if (station === StationId.PHONK) return 'phonk';
            if (station === StationId.SAMBA) return 'samba';
            return 'forro';
        };

        const fromTrack = prevStation ? getTrackName(prevStation) : null;
        const toTrack = getTrackName(id);

        this.audioManager.crossfade(fromTrack, toTrack, 0.2);

        // 3. Efeito de Sintonia
        if (!isInitialLoad) {
            this.audioManager.playTuningSequence();
        }
    }
}