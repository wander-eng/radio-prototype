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

export function canChangeStation(transformed: boolean): boolean {
    return !transformed;
}

export class RadioSystem {
    public currentStation: StationId | null = null;
    private activeTrack: string | null = null;
    
    private player: Player;
    private gameScene: GameScene;
    private audioManager: AudioManager;
    private effectsManager: EffectsManager;

    public get activeTrackId(): string | null {
        return this.activeTrack;
    }
    
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

        this.currentStation = id;
        this.applyBaseAppearance();
        this.switchTrack(this.getNormalTrackName(id));

        // Efeitos dinâmicos de sintonia permanecem ativos no gameplay.
        if (!isInitialLoad) {
            this.audioManager.playTuningSequence();
            this.effectsManager.playStationSwitchEffect(id, this.player.mesh.position);
        }
    }

    public activateTransformation() {
        if (!this.currentStation) return;

        this.applyStationManifestation(this.currentStation);
        const transformationTrack = this.getTransformationTrackName(this.currentStation);
        this.audioManager.restartTrackFromBeginning(transformationTrack);
        this.switchTrack(transformationTrack);
        this.effectsManager.playStationSwitchEffect(this.currentStation, this.player.mesh.position);
    }

    public deactivateTransformation() {
        if (!this.currentStation) return;

        this.applyBaseAppearance();
        const transformationTrack = this.getTransformationTrackName(this.currentStation);
        this.switchTrack(this.getNormalTrackName(this.currentStation));
        this.audioManager.stopTrack(transformationTrack, 0.2);
    }

    private applyBaseAppearance() {
        this.player.setNeutralColor();
        this.gameScene.setNeutralEnvironment();
    }

    private applyStationManifestation(station: StationId) {
        switch (station) {
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
    }

    private getNormalTrackName(station: StationId): string {
        if (station === StationId.PHONK) return 'phonk';
        if (station === StationId.SAMBA) return 'samba';
        return 'forro';
    }

    private getTransformationTrackName(station: StationId): string {
        return `${this.getNormalTrackName(station)}-transformation`;
    }

    private switchTrack(nextTrack: string) {
        if (this.activeTrack === nextTrack) return;
        this.audioManager.crossfade(this.activeTrack, nextTrack, 0.2);
        this.activeTrack = nextTrack;
    }
}
