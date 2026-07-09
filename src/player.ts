import * as THREE from 'three';
import { InputManager } from './input';
import { Target } from './target';

export class Player {
    public mesh: THREE.Mesh;
    private speed = 6;
    private attackCooldown = 0;
    private attackRange = 1.5;

    constructor() {
        // Raio: 0.5, Comprimento: 1 (Altura total = 2)
        const geometry = new THREE.CapsuleGeometry(0.5, 1, 4, 16);
        const material = new THREE.MeshStandardMaterial({ color: 0x0055ff }); // Azul
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.y = 1; // Centro em Y = 1 para pisar no chão
    }

    // Adicione este método dentro da classe Player (pode ser logo após o constructor):
    public setEmissiveColor(colorHex: number) {
        const material = this.mesh.material as THREE.MeshStandardMaterial;
        material.emissive.setHex(colorHex);
        material.emissiveIntensity = 1.0; 
        
        // Garante que a cor base também acompanhe a identidade visual
        material.color.setHex(colorHex); 
    }

    public update(delta: number, input: InputManager, camera: THREE.Camera, targets: Target[]) {
        if (this.attackCooldown > 0) {
            this.attackCooldown -= delta;
        }

        this.handleMovement(delta, input, camera);

        if (input.isPressed('Space') && this.attackCooldown <= 0) {
            this.attack(targets);
        }
    }

    private handleMovement(delta: number, input: InputManager, camera: THREE.Camera) {
        const moveDir = new THREE.Vector3();

        // Determina vetores de direção da câmera projetados no chão (eixo XZ)
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();

        const right = new THREE.Vector3();
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        // WASD
        if (input.isPressed('KeyW')) moveDir.add(forward);
        if (input.isPressed('KeyS')) moveDir.sub(forward);
        if (input.isPressed('KeyA')) moveDir.sub(right);
        if (input.isPressed('KeyD')) moveDir.add(right);

        if (moveDir.length() > 0) {
            moveDir.normalize();
            // Move o personagem
            this.mesh.position.add(moveDir.clone().multiplyScalar(this.speed * delta));
            
            // Faz o personagem olhar para a direção do movimento
            const targetRotation = Math.atan2(moveDir.x, moveDir.z);
            this.mesh.rotation.y = targetRotation;
        }
    }

    private attack(targets: Target[]) {
        this.attackCooldown = 0.4; // 400ms de cooldown (placeholder para o feel do ataque base)

        // Calcula o centro da área de ataque à frente do personagem
        const playerForward = new THREE.Vector3(Math.sin(this.mesh.rotation.y), 0, Math.cos(this.mesh.rotation.y)).normalize();
        const attackOrigin = this.mesh.position.clone();
        const hitCenter = attackOrigin.add(playerForward.clone().multiplyScalar(this.attackRange));

        // Teste de colisão esférico simples
        targets.forEach(target => {
            // Checa distância do centro do ataque até a base do alvo
            if (target.mesh.position.distanceTo(hitCenter) <= 1.5) {
                target.hit(playerForward);
            }
        });
    }
}