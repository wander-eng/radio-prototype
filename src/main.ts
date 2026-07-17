import './style.css';
import * as THREE from 'three';
import { GameScene } from './scene';
import { FollowCamera } from './camera';
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
import { createTimeStep, updateSlowMotionTimer } from './station-combat-math';

const appContainer = document.querySelector<HTMLDivElement>('#app');
if (!appContainer) throw new Error('Container #app não encontrado.');

const gameScene = new GameScene(appContainer);
const cameraSystem = new FollowCamera();
const input = new InputManager();

window.addEventListener('resize', () => {
    cameraSystem.camera.aspect = window.innerWidth / window.innerHeight;
    cameraSystem.camera.updateProjectionMatrix();
});

const hudManager = new UIManager();
let energy = 0;
let transformed = false;
let timeScale = 1;
let slowMoTimer = 0;
hudManager.updateEnergy(energy);

const beginSambaSlowMotion = () => {
    timeScale = 0.5;
    slowMoTimer = 0.15;
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

const player = new Player(hudManager, addEnergyForAttack, beginSambaSlowMotion);
gameScene.scene.add(player.mesh);

const staticTargets: Target[] = [
    new Target('target_0', new THREE.Vector3(-3, 0, -5)),
    new Target('target_1', new THREE.Vector3(-1.5, 0, -4.5))
];
staticTargets.forEach(target => gameScene.scene.add(target.mesh));
const encounter = new EncounterController(gameScene.scene, player);
const targets: CombatTarget[] = [...staticTargets, ...encounter.combatTargets];

const audioManager = new AudioManager();
const effectsManager = new EffectsManager(gameScene.scene, cameraSystem);
const radioSystem = new RadioSystem(player, gameScene, audioManager, effectsManager);

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
    timeScale = 1;
    slowMoTimer = 0;
    player.prepareForDeathLifecycle();
    setEnergy(0);
    transformed = false;
    radioSystem.deactivateTransformation();
};

const beginDeathLifecycle = () => {
    if (!player.isDead || deathLifecycleActive) return;
    deathLifecycleActive = true;
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
    await waitForPresentationFrame();
    hudManager.completeDeathRevive();
    deathLifecycleActive = false;
    reviveInProgress = false;
};

const resetEncounterImmediately = () => {
    resetPlayerSystemsForDeath();
    encounter.reset();
    player.resetAfterDeath();
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
    updateGameState(player, radioSystem, targets, encounter.snapshot(), {
        energy,
        transformed,
        auraIntensity: currentAuraIntensity,
        timeScale,
        slowMotionActive: slowMoTimer > 0,
        encounterStatus,
        inputBlocked: hudManager.isPaused || player.isDead || deathLifecycleActive,
        activeTrackId: radioSystem.activeTrackId,
        deathOverlayVisible: hudManager.deathOverlayVisible,
        reviveInProgress,
        reviveCount,
        encounterFrozen: hudManager.isPaused || deathLifecycleActive
    });
};

function animate() {
    requestAnimationFrame(animate);
    
    timer.update();
    const unscaledDelta = timer.getDelta();
    
    // SE PAUSADO: Interrompe a lógica matemática, congelando movimento e física no lugar
    if (hudManager.isPaused) {
        publishGameState('paused');
        gameScene.renderer.render(gameScene.scene, cameraSystem.camera);
        return;
    }

    let cameraDelta = 0;
    if (player.isDead || deathLifecycleActive) {
        beginDeathLifecycle();
    } else {
        slowMoTimer = updateSlowMotionTimer(slowMoTimer, unscaledDelta);
        if (slowMoTimer === 0) timeScale = 1;
        const timeStep = createTimeStep(unscaledDelta, timeScale);
        const delta = timeStep.scaledDeltaSeconds;
        cameraDelta = delta;

        if (input.consumePress('KeyR')) tryActivateTransformation();

        player.update(
            delta,
            input,
            cameraSystem.camera,
            targets,
            radioSystem.currentStation,
            encounter.combatTargets
        );
        const clampedPlayerPosition = clampArenaPosition(player.mesh.position);
        player.mesh.position.x = clampedPlayerPosition.x;
        player.mesh.position.z = clampedPlayerPosition.z;
        if (radioSystem.currentStation) encounter.update(delta, cameraSystem.camera);

        if (player.isDead) {
            beginDeathLifecycle();
        } else {
            staticTargets.forEach(target => target.update(delta, cameraSystem.camera));
            updateTransformation(unscaledDelta);
        }
    }

    if (!deathLifecycleActive) cameraSystem.update(player.mesh.position, cameraDelta);
    const currentAuraIntensity = auraIntensityForState(energy, transformed);
    if (!deathLifecycleActive) {
        effectsManager.update(
            unscaledDelta,
            player.mesh.position,
            radioSystem.currentStation,
            currentAuraIntensity
        );
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
