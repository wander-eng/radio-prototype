import './style.css';
import * as THREE from 'three';
import { GameScene } from './scene';
import { FollowCamera } from './camera';
import { Player } from './player';
import { Target } from './target';
import { InputManager } from './input';
import { AudioManager } from './audio';
import { RadioSystem, StationId } from './radio';

const appContainer = document.querySelector<HTMLDivElement>('#app');
if (!appContainer) throw new Error('Container #app não encontrado.');

const gameScene = new GameScene(appContainer);
const cameraSystem = new FollowCamera();
const input = new InputManager();

window.addEventListener('resize', () => {
    cameraSystem.camera.aspect = window.innerWidth / window.innerHeight;
    cameraSystem.camera.updateProjectionMatrix();
});

const player = new Player();
gameScene.scene.add(player.mesh);

// Adicionado um 3º Alvo para facilitar o teste da diferença de raio/AoE do Forró
const targets: Target[] = [
    new Target(new THREE.Vector3(-3, 0, -5)),
    new Target(new THREE.Vector3(-1.5, 0, -4.5)), 
    new Target(new THREE.Vector3(3, 0, -5))
];
targets.forEach(t => gameScene.scene.add(t.mesh));

const audioManager = new AudioManager();
const radioSystem = new RadioSystem(player, gameScene, audioManager);

let gameStarted = false;

const startGame = async () => {
    if (gameStarted) return;
    gameStarted = true;
    
    await audioManager.init();
    await audioManager.loadAll();
    
    radioSystem.setStation(StationId.SAMBA, true);
};

window.addEventListener('keydown', startGame, { once: true });
window.addEventListener('click', startGame, { once: true });

window.addEventListener('keydown', (e) => {
    if (!gameStarted) return; 
    
    if (e.code === 'Digit1') radioSystem.setStation(StationId.PHONK);
    if (e.code === 'Digit2') radioSystem.setStation(StationId.SAMBA);
    if (e.code === 'Digit3') radioSystem.setStation(StationId.FORRO);
});

// --- GERENCIAMENTO DE TEMPO ---
let timeScale = 1.0;
let slowMoTimer = 0;

const setTimeScale = (scale: number, unscaledDuration: number) => {
    timeScale = scale;
    slowMoTimer = unscaledDuration; // Tempo real (unscaled) de duração do evento
};

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    
    const unscaledDelta = clock.getDelta();
    
    if (slowMoTimer > 0) {
        slowMoTimer -= unscaledDelta;
        if (slowMoTimer <= 0) timeScale = 1.0; 
    }

    const delta = unscaledDelta * timeScale;

    // Removemos o unscaledDelta da chamada abaixo
    player.update(delta, input, cameraSystem.camera, targets, radioSystem.currentStation, setTimeScale);
    
    targets.forEach(t => t.update(delta));
    cameraSystem.update(player.mesh.position, delta);
    gameScene.renderer.render(gameScene.scene, cameraSystem.camera);
}

animate();