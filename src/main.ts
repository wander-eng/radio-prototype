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

// 1. Inicializa subsistemas base
const gameScene = new GameScene(appContainer);
const cameraSystem = new FollowCamera();
const input = new InputManager();

window.addEventListener('resize', () => {
    cameraSystem.camera.aspect = window.innerWidth / window.innerHeight;
    cameraSystem.camera.updateProjectionMatrix();
});

// 2. Instancia entidades
const player = new Player();
gameScene.scene.add(player.mesh);

const targets: Target[] = [
    new Target(new THREE.Vector3(-3, 0, -5)),
    new Target(new THREE.Vector3(3, 0, -5))
];
targets.forEach(t => gameScene.scene.add(t.mesh));

// 3. Inicializa Sistema de Rádio e Áudio
const audioManager = new AudioManager();
const radioSystem = new RadioSystem(player, gameScene, audioManager);

let gameStarted = false;

// Trata a política de autoplay do navegador: o áudio só inicializa após a primeira interação
const startGame = async () => {
    if (gameStarted) return;
    gameStarted = true;
    
    // Inicializa o contexto de áudio e carrega os buffers
    await audioManager.init();
    await audioManager.loadAll();
    
    // Define a estação padrão (Phonk) sem disparar o ruído de sintonia
    radioSystem.setStation(StationId.SAMBA, true);
};

// Captura a primeira interação (clique ou pressionar qualquer tecla, ex: WASD)
window.addEventListener('keydown', startGame, { once: true });
window.addEventListener('click', startGame, { once: true });

// Listeners exclusivos para a troca de rádio
window.addEventListener('keydown', (e) => {
    if (!gameStarted) return; // Só permite trocar se o jogo já iniciou
    
    if (e.code === 'Digit1') radioSystem.setStation(StationId.PHONK);
    if (e.code === 'Digit2') radioSystem.setStation(StationId.SAMBA);
    if (e.code === 'Digit3') radioSystem.setStation(StationId.FORRO);
});

// 4. Game Loop
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    player.update(delta, input, cameraSystem.camera, targets);
    targets.forEach(t => t.update(delta));
    cameraSystem.update(player.mesh.position, delta);
    
    gameScene.renderer.render(gameScene.scene, cameraSystem.camera);
}

animate();