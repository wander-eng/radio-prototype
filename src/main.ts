import './style.css';
import * as THREE from 'three';
import { GameScene } from './scene';
import { FollowCamera } from './camera';
import { Player } from './player';
import { Target } from './target';
import { InputManager } from './input';
import { AudioManager } from './audio';
import { RadioSystem, StationId } from './radio';
import { EffectsManager } from './effects';
import { UIManager } from './hud';
import { updateGameState } from './test-hook';

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
const player = new Player(hudManager);
gameScene.scene.add(player.mesh);

const targets: Target[] = [
    new Target(new THREE.Vector3(-3, 0, -5)),
    new Target(new THREE.Vector3(-1.5, 0, -4.5)), 
    new Target(new THREE.Vector3(3, 0, -5))
];
targets.forEach(t => gameScene.scene.add(t.mesh));

const audioManager = new AudioManager();
const effectsManager = new EffectsManager(gameScene.scene, cameraSystem);
const radioSystem = new RadioSystem(player, gameScene, audioManager, effectsManager);

// Conecta as barras de volume do Menu de Pause ao Motor de Áudio
hudManager.onMusicVolumeChange = (value: number) => audioManager.setMusicVolume(value);
hudManager.onSfxVolumeChange = (value: number) => audioManager.setSfxVolume(value);

// NOVO: Conecta o estado de Pause ao tempo do Motor de Áudio
hudManager.onPause = () => audioManager.pauseAudio();
hudManager.onResume = () => audioManager.resumeAudio();

let gameStarted = false;

const startGame = async () => {
    if (gameStarted) return;
    gameStarted = true;
    
    hudManager.hideStartMessage();
    
    await audioManager.init();
    await audioManager.loadAll();
    
    radioSystem.setStation(StationId.FORRO, true);
};

window.addEventListener('keydown', startGame, { once: true });
window.addEventListener('mousedown', startGame, { once: true }); 

window.addEventListener('keydown', (e) => {
    if (!gameStarted) return; 
    
    // Captura o ESC para comandar o Menu
    if (e.code === 'Escape') {
        hudManager.handleEscape();
        return;
    }
    
    // Bloqueia interações do rádio se estiver pausado
    if (hudManager.isPaused) return;

    if (e.code === 'Digit1') radioSystem.setStation(StationId.PHONK);
    if (e.code === 'Digit2') radioSystem.setStation(StationId.SAMBA);
    if (e.code === 'Digit3') radioSystem.setStation(StationId.FORRO);
});

window.addEventListener('wheel', (e) => {
    if (!gameStarted || !radioSystem.currentStation || hudManager.isPaused) return;
    
    const stations = [StationId.PHONK, StationId.SAMBA, StationId.FORRO];
    const currentIndex = stations.indexOf(radioSystem.currentStation);
    
    let nextIndex = currentIndex;
    
    if (e.deltaY > 0) nextIndex = (currentIndex + 1) % stations.length;
    else if (e.deltaY < 0) nextIndex = (currentIndex - 1 + stations.length) % stations.length;
    
    radioSystem.setStation(stations[nextIndex]);
});

let timeScale = 1.0;
let slowMoTimer = 0;

const setTimeScale = (scale: number, unscaledDuration: number) => {
    timeScale = scale;
    slowMoTimer = unscaledDuration; 
};

const timer = new THREE.Timer();

function animate() {
    requestAnimationFrame(animate);
    
    timer.update();
    const unscaledDelta = timer.getDelta();
    
    // SE PAUSADO: Interrompe a lógica matemática, congelando movimento e física no lugar
    if (hudManager.isPaused) {
        gameScene.renderer.render(gameScene.scene, cameraSystem.camera);
        return;
    }

    if (slowMoTimer > 0) {
        slowMoTimer -= unscaledDelta;
        if (slowMoTimer <= 0) timeScale = 1.0; 
    }

    const delta = unscaledDelta * timeScale;

    player.update(delta, input, cameraSystem.camera, targets, radioSystem.currentStation, setTimeScale);
    targets.forEach(t => t.update(delta, cameraSystem.camera));
    
    cameraSystem.update(player.mesh.position, delta);
    effectsManager.update(unscaledDelta, player.mesh.position, radioSystem.currentStation);
    
    // NOVO: Exposição de estado contínua para o Playwright
    updateGameState(player, radioSystem, targets);

    gameScene.renderer.render(gameScene.scene, cameraSystem.camera);
}

animate();