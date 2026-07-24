import './style.css';
import * as THREE from 'three';
import { GameScene } from './scene';
import { FollowCamera } from './camera';
import { CameraShakeController } from './camera-shake';
import { Player } from './player';
import { Target } from './target';
import type { CombatTarget } from './combat-target';
import { EncounterController } from './encounter-controller';
import { InputManager } from './input';
import { AudioManager } from './audio';
import { canChangeStation, RadioSystem, StationId } from './radio';
import { EffectsManager } from './effects';
import { UIManager } from './hud';
import { installGameTestControls, updateGameState } from './test-hook';
import {
    auraIntensityForState,
    canTransform,
    clampEnergy,
    drainTransformationEnergy,
    energyGainForAttack
} from './combat-math';
import { clampArenaPosition } from './melee-math';
import { CombatTimeController } from './combat-time';
import {
    createImpactActionIdSource,
    ImpactEventStore,
    type ImpactEvent,
    type ImpactEventDependencies,
    type ImpactStation
} from './impact-event';
import { isImpactReactive, type ImpactReactive } from './impact-reaction';
import { ImpactSparkController } from './impact-sparks';

const appContainer = document.querySelector<HTMLDivElement>('#app');
if (!appContainer) throw new Error('Container #app não encontrado.');

const gameScene = new GameScene(appContainer);
const cameraSystem = new FollowCamera();
const cameraShake = new CameraShakeController();
const input = new InputManager();

window.addEventListener('resize', () => {
    cameraSystem.camera.aspect = window.innerWidth / window.innerHeight;
    cameraSystem.camera.updateProjectionMatrix();
});

const hudManager = new UIManager();
let energy = 0;
let transformed = false;
const combatTime = new CombatTimeController();
const impactEventStore = new ImpactEventStore();
let radioSystem: RadioSystem;
hudManager.updateEnergy(energy);

const toImpactStation = (station: StationId | null): ImpactStation => {
    if (station === StationId.PHONK) return 'phonk';
    if (station === StationId.SAMBA) return 'samba';
    if (station === StationId.FORRO) return 'forro';
    return null;
};

const nextImpactActionId = createImpactActionIdSource();
function dispatchImpactReaction(event: ImpactEvent) {
    for (const targetResult of event.targets) {
        const target = targetResult.targetId === 'player'
            ? player
            : targets.find(candidate => candidate.id === targetResult.targetId);
        if (isImpactReactive(target)) {
            target.applyImpactReaction(event, targetResult);
        }
    }
}

const impactDependencies: ImpactEventDependencies = {
    nextActionId: nextImpactActionId,
    emit: (event) => {
        impactEventStore.record(event);
        combatTime.requestHitstop(event);
        dispatchImpactReaction(event);
        cameraShake.request(event);
        impactSparks.request(event);
        audioManager.playImpact(event);
    },
    getContext: () => ({
        station: toImpactStation(radioSystem.currentStation),
        transformed
    })
};

const beginSambaSlowMotion = () => {
    combatTime.startSambaSlowMotion();
};

const setEnergy = (nextEnergy: number) => {
    if (nextEnergy === energy) return;

    energy = nextEnergy;
    hudManager.updateEnergy(energy);
    console.log(`[ENERGIA] ${energy.toFixed(2)}`);
};

const addEnergyForAttack = (successfulHitCount: number) => {
    const gain = energyGainForAttack(successfulHitCount, transformed);
    if (gain === 0) return;
    setEnergy(clampEnergy(energy, gain));
};

const player = new Player(
    hudManager,
    addEnergyForAttack,
    beginSambaSlowMotion,
    impactDependencies
);
gameScene.scene.add(player.mesh);

const staticTargets: Target[] = [
    new Target('target_0', new THREE.Vector3(-3, 0, -5)),
    new Target('target_1', new THREE.Vector3(-1.5, 0, -4.5))
];
staticTargets.forEach(target => gameScene.scene.add(target.mesh));
const encounter = new EncounterController(gameScene.scene, player, impactDependencies);
const targets: CombatTarget[] = [...staticTargets, ...encounter.combatTargets];

const impactReactiveEntities = (): Array<{ id: string; entity: ImpactReactive }> => {
    const entities: Array<{ id: string; value: unknown }> = [
        { id: 'player', value: player },
        ...targets.map(target => ({ id: target.id, value: target }))
    ];
    return entities
        .filter(({ value }) => isImpactReactive(value))
        .map(({ id, value }) => ({ id, entity: value as ImpactReactive }));
};

const updateImpactReactions = (
    presentationDeltaSeconds: number,
    gameplayDeltaSeconds: number
) => {
    impactReactiveEntities().forEach(({ entity }) => {
        entity.updateImpactReaction(presentationDeltaSeconds, gameplayDeltaSeconds);
    });
};

const resetImpactReactions = () => {
    impactReactiveEntities().forEach(({ entity }) => entity.resetImpactReaction());
};

const audioManager = new AudioManager();
const effectsManager = new EffectsManager(gameScene.scene, cameraSystem);
const impactSparks = new ImpactSparkController(gameScene.scene);
radioSystem = new RadioSystem(player, gameScene, audioManager, effectsManager);

const tryActivateTransformation = () => {
    if (transformed || !radioSystem.currentStation || !canTransform(energy)) return;

    transformed = true;
    radioSystem.activateTransformation();
};

const updateTransformation = (deltaSeconds: number) => {
    if (!transformed) return;

    setEnergy(drainTransformationEnergy(energy, deltaSeconds));
    if (energy === 0) {
        transformed = false;
        radioSystem.deactivateTransformation();
    }
};

let deathLifecycleActive = false;
let reviveInProgress = false;
let reviveCount = 0;

const resetPlayerSystemsForDeath = () => {
    combatTime.clearTransientSources();
    cameraShake.reset();
    cameraSystem.clearPresentationOffset();
    impactSparks.reset();
    audioManager.resetImpactVoices();
    resetImpactReactions();
    player.prepareForDeathLifecycle();
    setEnergy(0);
    transformed = false;
    radioSystem.deactivateTransformation();
};

const beginDeathLifecycle = () => {
    if (!player.isDead || deathLifecycleActive) return;
    deathLifecycleActive = true;
    combatTime.setDead(true);
    resetPlayerSystemsForDeath();
    hudManager.showDeathOverlay();
};

const waitForPresentationFrame = () => new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
});

const revivePlayer = async () => {
    if (!deathLifecycleActive || reviveInProgress || !player.isDead) return;
    reviveInProgress = true;
    reviveCount++;

    resetPlayerSystemsForDeath();
    encounter.reset();
    player.resetAfterDeath();
    impactEventStore.reset();
    combatTime.reset();
    await waitForPresentationFrame();
    hudManager.completeDeathRevive();
    deathLifecycleActive = false;
    reviveInProgress = false;
};

const resetEncounterImmediately = () => {
    resetPlayerSystemsForDeath();
    encounter.reset();
    player.resetAfterDeath();
    impactEventStore.reset();
    combatTime.reset();
    hudManager.completeDeathRevive();
    deathLifecycleActive = false;
    reviveInProgress = false;
};

hudManager.onRevive = revivePlayer;

let gameStarted = false;

const startGame = async (loadAudio: boolean) => {
    if (gameStarted) return;
    gameStarted = true;
    hudManager.hideStartMessage();

    if (loadAudio) {
        await audioManager.init();
        await audioManager.loadAll();
    }

    radioSystem.setStation(StationId.FORRO, true);
};

installGameTestControls({
    startGame: () => startGame(false),
    setEnergy: (value) => setEnergy(clampEnergy(0, value)),
    advanceTransformation: (deltaSeconds) => updateTransformation(Math.max(0, deltaSeconds)),
    setPlayerPosition: (x, y, z) => player.mesh.position.set(x, y, z),
    setEnemyPosition: (id, x, y, z) => encounter.setEnemyPosition(id, x, y, z),
    setCombatTargetPosition: (id, x, y, z) => {
        const target = targets.find(candidate => candidate.id === id);
        if (!target) return;
        const clamped = clampArenaPosition({ x, z });
        target.mesh.position.set(clamped.x, y, clamped.z);
    },
    spawnProjectileAtPlayer: (x, y, z) => encounter.spawnProjectile(
        new THREE.Vector3(x, y, z),
        player.mesh.position.clone()
    ),
    damagePlayer: (damage) => {
        player.receiveAttack(damage);
        beginDeathLifecycle();
    },
    revivePlayer,
    advanceEncounter: (deltaSeconds) => encounter.update(
        Math.max(0, deltaSeconds),
        cameraSystem.camera
    ),
    getEncounterSnapshot: () => encounter.snapshot(),
    resetEncounter: resetEncounterImmediately,
    openSambaDodgeWindow: () => player.openSambaDodgeWindow(),
    prepareSambaCounter: () => player.openSambaDashWindows(),
    resolvePlayerAttack: () => radioSystem.currentStation
        ? player.resolveCommittedAttack(radioSystem.currentStation, targets)
        : false,
    resolvePendingMeleeAttack: (id) => encounter.resolvePendingMeleeAttack(id),
    setEnemyHp: (id, hp) => {
        const target = targets.find(candidate => candidate.id === id);
        if (!target || target.state !== 'active') return;
        const clampedHp = Math.min(target.maxHp, Math.max(0, hp));
        if (clampedHp < target.hp) {
            target.receiveHit(new THREE.Vector3(), target.hp - clampedHp);
        }
    }
});

// Conecta as barras de volume do Menu de Pause ao Motor de Áudio
hudManager.onMusicVolumeChange = (value: number) => audioManager.setMusicVolume(value);
hudManager.onSfxVolumeChange = (value: number) => audioManager.setSfxVolume(value);

// NOVO: Conecta o estado de Pause ao tempo do Motor de Áudio
hudManager.onPause = () => audioManager.pauseAudio();
hudManager.onResume = () => audioManager.resumeAudio();

const startGameFromInput = () => {
    void startGame(true);
};

window.addEventListener('keydown', startGameFromInput, { once: true });
window.addEventListener('mousedown', startGameFromInput, { once: true });

window.addEventListener('keydown', (e) => {
    if (!gameStarted) return; 
    if (player.isDead || deathLifecycleActive) return;
    
    // Captura o ESC para comandar o Menu
    if (e.code === 'Escape') {
        hudManager.handleEscape();
        return;
    }
    
    // Bloqueia interações do rádio se estiver pausado
    if (hudManager.isPaused) return;
    if (!canChangeStation(transformed)) return;

    if (e.code === 'Digit1') radioSystem.setStation(StationId.PHONK);
    if (e.code === 'Digit2') radioSystem.setStation(StationId.SAMBA);
    if (e.code === 'Digit3') radioSystem.setStation(StationId.FORRO);
});

window.addEventListener('wheel', (e) => {
    if (!gameStarted || !radioSystem.currentStation || hudManager.isPaused || player.isDead || !canChangeStation(transformed)) return;
    
    const stations = [StationId.PHONK, StationId.SAMBA, StationId.FORRO];
    const currentIndex = stations.indexOf(radioSystem.currentStation);
    
    let nextIndex = currentIndex;
    
    if (e.deltaY > 0) nextIndex = (currentIndex + 1) % stations.length;
    else if (e.deltaY < 0) nextIndex = (currentIndex - 1 + stations.length) % stations.length;
    
    radioSystem.setStation(stations[nextIndex]);
});

const timer = new THREE.Timer();

const publishGameState = (encounterStatus: 'active' | 'paused' | 'awaiting-revive' | 'reviving') => {
    const currentAuraIntensity = auraIntensityForState(energy, transformed);
    const timeSnapshot = combatTime.snapshot;
    const cameraShakeSnapshot = cameraShake.snapshot;
    const impactSparkSnapshot = impactSparks.snapshot;
    const reactiveEntities = impactReactiveEntities();
    const flashingEntityIds = reactiveEntities
        .filter(({ entity }) => entity.impactReactionSnapshot.flashActive)
        .map(({ id }) => id);
    const knockbackEntityIds = reactiveEntities
        .filter(({ entity }) => entity.impactReactionSnapshot.knockbackActive)
        .map(({ id }) => id);
    updateGameState(player, radioSystem, targets, encounter.snapshot(), {
        energy,
        transformed,
        auraIntensity: currentAuraIntensity,
        timeScale: player.isDead || deathLifecycleActive
            ? 1
            : timeSnapshot.effectiveTimeScale,
        slowMotionActive: timeSnapshot.sambaSlowMotionActive,
        hitstopActive: timeSnapshot.hitstopActive,
        hitstopRemaining: timeSnapshot.hitstopRemaining,
        effectiveTimeScale: timeSnapshot.effectiveTimeScale,
        activeTimeSources: timeSnapshot.activeTimeSources,
        encounterStatus,
        inputBlocked: hudManager.isPaused || player.isDead || deathLifecycleActive,
        activeTrackId: radioSystem.activeTrackId,
        deathOverlayVisible: hudManager.deathOverlayVisible,
        reviveInProgress,
        reviveCount,
        encounterFrozen: hudManager.isPaused || deathLifecycleActive,
        flashingEntityIds,
        knockbackEntityIds,
        cameraShakeActive: cameraShakeSnapshot.active,
        cameraShakeIntensity: cameraShakeSnapshot.intensity,
        cameraShakeImpulseCount: cameraShakeSnapshot.activeImpulseCount,
        impactParticleCount: impactSparkSnapshot.particleCount,
        impactBurstCount: impactSparkSnapshot.burstCount,
        activeImpactVoiceCount: audioManager.activeImpactVoiceCount,
        activeImpactEffectCount:
            impactSparkSnapshot.burstCount + audioManager.activeImpactVoiceCount
    }, impactEventStore.lastImpact);
};

function animate() {
    requestAnimationFrame(animate);
    
    timer.update();
    const unscaledDelta = timer.getDelta();

    combatTime.setPaused(hudManager.isPaused);
    cameraShake.setPaused(hudManager.isPaused);
    impactSparks.setPaused(hudManager.isPaused);

    // SE PAUSADO: Interrompe a lógica matemática, congelando movimento e física no lugar
    if (hudManager.isPaused) {
        cameraSystem.clearPresentationOffset();
        publishGameState('paused');
        gameScene.renderer.render(gameScene.scene, cameraSystem.camera);
        return;
    }

    combatTime.setDead(player.isDead || deathLifecycleActive);
    let presentationDelta = unscaledDelta;
    let gameplayDelta = 0;
    if (player.isDead || deathLifecycleActive) {
        beginDeathLifecycle();
    } else {
        const timeStep = combatTime.advance(unscaledDelta);
        gameplayDelta = timeStep.gameplayDeltaSeconds;
        presentationDelta = timeStep.presentationDeltaSeconds;

        if (gameplayDelta > 0) {
            if (input.consumePress('KeyR')) tryActivateTransformation();

            player.update(
                gameplayDelta,
                input,
                cameraSystem.camera,
                targets,
                radioSystem.currentStation,
                encounter.combatTargets
            );
            const clampedPlayerPosition = clampArenaPosition(player.mesh.position);
            player.mesh.position.x = clampedPlayerPosition.x;
            player.mesh.position.z = clampedPlayerPosition.z;
            if (radioSystem.currentStation) {
                encounter.update(gameplayDelta, cameraSystem.camera);
            }
        }

        if (player.isDead) {
            beginDeathLifecycle();
        } else {
            if (gameplayDelta > 0) {
                staticTargets.forEach(target =>
                    target.update(gameplayDelta, cameraSystem.camera)
                );
            }
            updateTransformation(unscaledDelta);
        }
    }

    if (!deathLifecycleActive) {
        updateImpactReactions(presentationDelta, gameplayDelta);
    }

    if (!deathLifecycleActive) {
        cameraSystem.update(player.mesh.position, presentationDelta);
    }
    const currentAuraIntensity = auraIntensityForState(energy, transformed);
    if (!deathLifecycleActive) {
        effectsManager.update(
            presentationDelta,
            player.mesh.position,
            radioSystem.currentStation,
            currentAuraIntensity
        );
        impactSparks.update(presentationDelta);
        audioManager.updateImpactVoices(presentationDelta);
        cameraSystem.applyPresentationOffset(cameraShake.advance(presentationDelta));
    }
    
    // NOVO: Exposição de estado contínua para o Playwright
    publishGameState(
        reviveInProgress
            ? 'reviving'
            : deathLifecycleActive ? 'awaiting-revive' : 'active'
    );

    gameScene.renderer.render(gameScene.scene, cameraSystem.camera);
}

animate();
