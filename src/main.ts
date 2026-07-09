import './style.css';
import * as THREE from 'three';
import { GameScene } from './scene';
import { FollowCamera } from './camera';
import { Player } from './player';
import { Target } from './target';
import { InputManager } from './input';

const appContainer = document.querySelector<HTMLDivElement>('#app');

if (!appContainer) {
    throw new Error('Container #app não encontrado.');
}

// 1. Inicializa subsistemas
const gameScene = new GameScene(appContainer);
const cameraSystem = new FollowCamera();
const input = new InputManager();

// Fixando a proporção da câmera no redimensionamento da janela
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

// 3. Game Loop
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();

    // Atualiza lógica das entidades
    player.update(delta, input, cameraSystem.camera, targets);
    targets.forEach(t => t.update(delta));
    
    // Atualiza câmera
    cameraSystem.update(player.mesh.position, delta);

    // Renderiza a cena
    gameScene.renderer.render(gameScene.scene, cameraSystem.camera);
}

// Inicia
animate();