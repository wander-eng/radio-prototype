import type { Player } from './player';
import { StationId } from './radio';
import type { RadioSystem } from './radio';
import type { Target } from './target';

export interface GameState {
    station: 'phonk' | 'samba' | 'forro' | 'none';
    combo: number;
    player: { x: number; z: number; hp: number };
    targets: Array<{ id: string; hp: number; alive: boolean }>;
}

declare global {
    interface Window {
        __GAME_STATE__: GameState;
    }
}

export function updateGameState(player: Player, radioSystem: RadioSystem, targets: Target[]) {
    let stationStr: GameState['station'] = 'none';
    if (radioSystem.currentStation === StationId.PHONK) stationStr = 'phonk';
    if (radioSystem.currentStation === StationId.SAMBA) stationStr = 'samba';
    if (radioSystem.currentStation === StationId.FORRO) stationStr = 'forro';

    // Acessando propriedade privada via cast para evitar alteração estrutural no player.ts
    const currentCombo = (player as any).globalCombo || 0;

    window.__GAME_STATE__ = {
        station: stationStr,
        combo: currentCombo,
        player: {
            x: player.mesh.position.x,
            z: player.mesh.position.z,
            // NOTA: O HP do jogador existe, mas atualmente é apenas scaffolding (100 fixo). 
            // O valor está sendo exposto, mas ainda não há mecânica de receber dano implementada.
            hp: player.hp
        },
        targets: targets.map((t, index) => ({
            id: `target_${index}`,
            hp: t.hp,
            alive: t.state === 'active'
        }))
    };
}