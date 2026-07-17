import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { AudioManager } from './audio';
import type { EffectsManager } from './effects';
import type { Player } from './player';
import { canChangeStation, RadioSystem, StationId } from './radio';
import type { GameScene } from './scene';

describe('canChangeStation', () => {
    it('bloqueia troca enquanto transformado', () => {
        expect(canChangeStation(true)).toBe(false);
    });

    it('reativa troca depois que a transformação termina', () => {
        expect(canChangeStation(false)).toBe(true);
    });
});

describe('RadioSystem death reset', () => {
    it('interrompe a faixa emblematica e restaura faixa normal e visual neutro', () => {
        const player = {
            mesh: { position: new THREE.Vector3() },
            setNeutralColor: vi.fn(),
            setEmissiveColor: vi.fn()
        } as unknown as Player;
        const scene = {
            setNeutralEnvironment: vi.fn(),
            setEnvironmentColor: vi.fn()
        } as unknown as GameScene;
        const audio = {
            crossfade: vi.fn(),
            restartTrackFromBeginning: vi.fn(),
            stopTrack: vi.fn(),
            playTuningSequence: vi.fn()
        } as unknown as AudioManager;
        const effects = { playStationSwitchEffect: vi.fn() } as unknown as EffectsManager;
        const radio = new RadioSystem(player, scene, audio, effects);

        radio.setStation(StationId.SAMBA, true);
        radio.activateTransformation();
        radio.deactivateTransformation();

        expect(radio.currentStation).toBe(StationId.SAMBA);
        expect(radio.activeTrackId).toBe('samba');
        expect(audio.crossfade).toHaveBeenLastCalledWith('samba-transformation', 'samba', 0.2);
        expect(audio.stopTrack).toHaveBeenCalledWith('samba-transformation', 0.2);
        expect(player.setNeutralColor).toHaveBeenCalled();
        expect(scene.setNeutralEnvironment).toHaveBeenCalled();
    });
});
