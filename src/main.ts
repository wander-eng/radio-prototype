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

let gameStarted = false;

const startGame = async () => {
    if (gameStarted) return;
    gameStarted = true;
    
    await audioManager.init();
    await audioManager.loadAll();
    
    radioSystem.setStation(StationId.FORRO, true);
};

window.addEventListener('keydown', startGame, { once: true });
window.addEventListener('mousedown', startGame, { once: true }); // Tira a tela do estado pausado com o mouse também

// Troca Direta (Teclado)
window.addEventListener('keydown', (e) => {
    if (!gameStarted) return; 
    
    if (e.code === 'Digit1') radioSystem.setStation(StationId.PHONK);
    if (e.code === 'Digit2') radioSystem.setStation(StationId.SAMBA);
    if (e.code === 'Digit3') radioSystem.setStation(StationId.FORRO);
});

// Troca Sequencial (Scroll do Mouse)
window.addEventListener('wheel', (e) => {
    if (!gameStarted || !radioSystem.currentStation) return;
    
    const stations = [StationId.PHONK, StationId.SAMBA, StationId.FORRO];
    const currentIndex = stations.indexOf(radioSystem.currentStation);
    
    let nextIndex = currentIndex;
    
    if (e.deltaY > 0) {
        // Scroll pra baixo: Avança
        nextIndex = (currentIndex + 1) % stations.length;
    } else if (e.deltaY < 0) {
        // Scroll pra cima: Retorna
        nextIndex = (currentIndex - 1 + stations.length) % stations.length;
    }
    
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
    
    if (slowMoTimer > 0) {
        slowMoTimer -= unscaledDelta;
        if (slowMoTimer <= 0) timeScale = 1.0; 
    }

    const delta = unscaledDelta * timeScale;

    player.update(delta, input, cameraSystem.camera, targets, radioSystem.currentStation, setTimeScale);
    targets.forEach(t => t.update(delta, cameraSystem.camera));
    
    cameraSystem.update(player.mesh.position, delta);
    effectsManager.update(unscaledDelta, player.mesh.position, radioSystem.currentStation);
    
    gameScene.renderer.render(gameScene.scene, cameraSystem.camera);
}

animate();