import type { Player } from './player';
import type { CombatTarget } from './combat-target';
import type { EncounterSnapshot } from './encounter-controller';
import type { ImpactEvent, ImpactKind } from './impact-event';
import { impactIntensityForKind } from './impact-math';
import { selectImpactPreset } from './impact-presets';
import type { ActiveTimeSource } from './combat-time';
import { StationId } from './radio';
import type { RadioSystem } from './radio';

export interface GameState {
    station: 'phonk' | 'samba' | 'forro' | 'none';
    energy: number;
    transformed: boolean;
    auraIntensity: number;
    combo: number;
    sambaDodgeActive: boolean;
    sambaCounterReady: boolean;
    sambaCounterRemaining: number;
    slowMotionActive: boolean;
    timeScale: number;
    hitstopActive: boolean;
    hitstopRemaining: number;
    effectiveTimeScale: number;
    activeTimeSources: readonly ActiveTimeSource[];
    flashingEntityIds: readonly string[];
    knockbackEntityIds: readonly string[];
    cameraShakeActive: boolean;
    cameraShakeIntensity: number;
    cameraShakeImpulseCount: number;
    impactParticleCount: number;
    impactBurstCount: number;
    activeImpactVoiceCount: number;
    activeImpactEffectCount: number;
    encounterStatus: 'active' | 'paused' | 'awaiting-revive' | 'reviving';
    inputBlocked: boolean;
    deathOverlayVisible: boolean;
    reviveInProgress: boolean;
    reviveCount: number;
    encounterFrozen: boolean;
    activeTrackId: string | null;
    forroDashEnergyGranted: boolean;
    forroDashHitCount: number;
    lastCommittedAimSource: 'direct' | 'assisted' | 'none';
    lastCommittedAimTargetId: string | null;
    attackCommitCount: number;
    lastImpactKind: ImpactKind | null;
    lastImpactActionId: number | null;
    lastImpactIntensity: number | null;
    lastImpactPreset: string | null;
    lastImpactStation: ImpactEvent['station'] | null;
    lastImpactTransformed: boolean | null;
    lastImpact: ImpactEvent | null;
    player: {
        x: number;
        y: number;
        z: number;
        position: { x: number; y: number; z: number };
        hp: number;
        maxHp: number;
        alive: boolean;
        dead: boolean;
        invulnerable: boolean;
        dashing: boolean;
        attackState: 'idle' | 'windup' | 'recovery';
        airborne: boolean;
        jumpCount: number;
        jumpInputReady: boolean;
    };
    targets: Array<{ id: string; hp: number; alive: boolean }>;
    enemies: EncounterSnapshot['enemies'];
    projectiles: EncounterSnapshot['projectiles'];
    projectileCount: number;
    meleeAttackOwnerId: string | null;
}

export interface ObservableTransformationState {
    energy: number;
    transformed: boolean;
    auraIntensity: number;
    timeScale: number;
    slowMotionActive: boolean;
    hitstopActive: boolean;
    hitstopRemaining: number;
    effectiveTimeScale: number;
    activeTimeSources: readonly ActiveTimeSource[];
    flashingEntityIds: readonly string[];
    knockbackEntityIds: readonly string[];
    cameraShakeActive: boolean;
    cameraShakeIntensity: number;
    cameraShakeImpulseCount: number;
    impactParticleCount: number;
    impactBurstCount: number;
    activeImpactVoiceCount: number;
    activeImpactEffectCount: number;
    encounterStatus: GameState['encounterStatus'];
    inputBlocked: boolean;
    deathOverlayVisible: boolean;
    reviveInProgress: boolean;
    reviveCount: number;
    encounterFrozen: boolean;
    activeTrackId: string | null;
}

export interface GameTestControls {
    startGame(): Promise<void>;
    setEnergy(value: number): void;
    advanceTransformation(deltaSeconds: number): void;
    setPlayerPosition(x: number, y: number, z: number): void;
    setEnemyPosition(id: string, x: number, y: number, z: number): void;
    setCombatTargetPosition(id: string, x: number, y: number, z: number): void;
    spawnProjectileAtPlayer(x: number, y: number, z: number): void;
    damagePlayer(damage: number): void;
    revivePlayer(): Promise<void>;
    advanceEncounter(deltaSeconds: number): void;
    getEncounterSnapshot(): EncounterSnapshot;
    resetEncounter(): void;
    setEnemyHp(id: string, hp: number): void;
    openSambaDodgeWindow(): void;
    prepareSambaCounter(): void;
    resolvePlayerAttack(): boolean;
    resolvePendingMeleeAttack(id: string): boolean;
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
    targets: readonly CombatTarget[],
    encounter: EncounterSnapshot,
    transformationState: ObservableTransformationState,
    lastImpact: ImpactEvent | null = null
) {
    if (!import.meta.env.DEV) return;

    let stationStr: GameState['station'] = 'none';
    if (radioSystem.currentStation === StationId.PHONK) stationStr = 'phonk';
    if (radioSystem.currentStation === StationId.SAMBA) stationStr = 'samba';
    if (radioSystem.currentStation === StationId.FORRO) stationStr = 'forro';

    window.__GAME_STATE__ = {
        station: stationStr,
        energy: transformationState.energy,
        transformed: transformationState.transformed,
        auraIntensity: transformationState.auraIntensity,
        combo: player.comboCount,
        sambaDodgeActive: player.isSambaDodgeActive,
        sambaCounterReady: player.sambaCounterReady,
        sambaCounterRemaining: player.sambaCounterRemaining,
        slowMotionActive: transformationState.slowMotionActive,
        timeScale: transformationState.timeScale,
        hitstopActive: transformationState.hitstopActive,
        hitstopRemaining: transformationState.hitstopRemaining,
        effectiveTimeScale: transformationState.effectiveTimeScale,
        activeTimeSources: [...transformationState.activeTimeSources],
        flashingEntityIds: [...transformationState.flashingEntityIds],
        knockbackEntityIds: [...transformationState.knockbackEntityIds],
        cameraShakeActive: transformationState.cameraShakeActive,
        cameraShakeIntensity: transformationState.cameraShakeIntensity,
        cameraShakeImpulseCount: transformationState.cameraShakeImpulseCount,
        impactParticleCount: transformationState.impactParticleCount,
        impactBurstCount: transformationState.impactBurstCount,
        activeImpactVoiceCount: transformationState.activeImpactVoiceCount,
        activeImpactEffectCount: transformationState.activeImpactEffectCount,
        encounterStatus: transformationState.encounterStatus,
        inputBlocked: transformationState.inputBlocked,
        deathOverlayVisible: transformationState.deathOverlayVisible,
        reviveInProgress: transformationState.reviveInProgress,
        reviveCount: transformationState.reviveCount,
        encounterFrozen: transformationState.encounterFrozen,
        activeTrackId: transformationState.activeTrackId,
        forroDashEnergyGranted: player.forroDashEnergyWasGranted,
        forroDashHitCount: player.forroDashHitCount,
        lastCommittedAimSource: player.lastCommittedAimSource,
        lastCommittedAimTargetId: player.lastCommittedAimTargetId,
        attackCommitCount: player.attackCommitCount,
        lastImpactKind: lastImpact?.kind ?? null,
        lastImpactActionId: lastImpact?.actionId ?? null,
        lastImpactIntensity: lastImpact
            ? impactIntensityForKind(lastImpact.kind)
            : null,
        lastImpactPreset: lastImpact ? selectImpactPreset(lastImpact).id : null,
        lastImpactStation: lastImpact?.station ?? null,
        lastImpactTransformed: lastImpact?.transformed ?? null,
        lastImpact,
        player: {
            x: player.mesh.position.x,
            y: player.mesh.position.y,
            z: player.mesh.position.z,
            position: {
                x: player.mesh.position.x,
                y: player.mesh.position.y,
                z: player.mesh.position.z
            },
            hp: player.hp,
            maxHp: player.maxHp,
            alive: !player.isDead,
            dead: player.isDead,
            invulnerable: player.isDamageInvulnerable,
            dashing: player.isCurrentlyDashing,
            attackState: player.currentAttackState,
            airborne: player.isAirborne,
            jumpCount: player.currentJumpCount,
            jumpInputReady: player.jumpInputReady
        },
        targets: targets.map((target) => ({
            id: target.id,
            hp: target.hp,
            alive: target.state === 'active'
        })),
        enemies: encounter.enemies,
        projectiles: encounter.projectiles,
        projectileCount: encounter.projectiles.length,
        meleeAttackOwnerId: encounter.meleeAttackOwnerId
    };
}
