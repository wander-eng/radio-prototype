import type { Player } from './player';
import { StationId } from './radio';
import type { RadioSystem } from './radio';
import type { Target } from './target';

export interface GameState {
    station: 'phonk' | 'samba' | 'forro' | 'none';
    energy: number;
    transformed: boolean;
    auraIntensity: number;
    combo: number;
    player: { x: number; z: number; hp: number };
    targets: Array<{ id: string; hp: number; alive: boolean }>;
}

export interface ObservableTransformationState {
    energy: number;
    transformed: boolean;
    auraIntensity: number;
}

export interface GameTestControls {
    setEnergy(value: number): void;
    advanceTransformation(deltaSeconds: number): void;
}

declare global {
    interface Window {
        __GAME_STATE__: GameState;
        __GAME_TEST__: GameTestControls;
    }
}

export function installGameTestControls(controls: GameTestControls) {
    if (!import.meta.env.DEV) return;
    window.__GAME_TEST__ = controls;
}

export function updateGameState(
    player: Player,
    radioSystem: RadioSystem,
    targets: Target[],
    transformationState: ObservableTransformationState
) {
    if (!import.meta.env.DEV) return;

    let stationStr: GameState['station'] = 'none';
    if (radioSystem.currentStation === StationId.PHONK) stationStr = 'phonk';
    if (radioSystem.currentStation === StationId.SAMBA) stationStr = 'samba';
    if (radioSystem.currentStation === StationId.FORRO) stationStr = 'forro';

    // Acessando propriedade privada via cast para evitar alteração estrutural no player.ts
    const currentCombo = (player as any).globalCombo || 0;

    window.__GAME_STATE__ = {
        station: stationStr,
        energy: transformationState.energy,
        transformed: transformationState.transformed,
        auraIntensity: transformationState.auraIntensity,
        combo: currentCombo,
        player: {
            x: player.mesh.position.x,
            z: player.mesh.position.z,
            // O HP ainda é scaffolding (100 fixo), mas permanece observável para os testes existentes.
            hp: player.hp
        },
        targets: targets.map((target, index) => ({
            id: `target_${index}`,
            hp: target.hp,
            alive: target.state === 'active'
        }))
    };
}
