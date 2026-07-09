import * as THREE from 'three';

export class Target {
    public mesh: THREE.Mesh;
    private baseColor = 0xb22222; // Vermelho escuro
    private flashColor = 0xffffff; // Branco
    private flashTimer = 0;
    private originalPosition: THREE.Vector3;

    constructor(position: THREE.Vector3) {
        const geometry = new THREE.BoxGeometry(1, 2, 1);
        const material = new THREE.MeshStandardMaterial({ color: this.baseColor });
        this.mesh = new THREE.Mesh(geometry, material);
        
        this.mesh.position.copy(position);
        this.mesh.position.y = 1; // Ajusta para não cruzar o chão
        this.originalPosition = this.mesh.position.clone();
    }

    public hit(direction: THREE.Vector3) {
        // Inicia o piscar (100ms)
        this.flashTimer = 0.1;
        const material = this.mesh.material as THREE.MeshStandardMaterial;
        material.color.setHex(this.flashColor);
        material.emissive.setHex(0x555555);

        // Aplica o deslocamento visual do knockback
        const knockbackForce = direction.clone().normalize().multiplyScalar(0.8);
        this.mesh.position.add(knockbackForce);
    }

    public update(delta: number) {
        // Gerencia o tempo do piscar visual
        if (this.flashTimer > 0) {
            this.flashTimer -= delta;
            if (this.flashTimer <= 0) {
                const material = this.mesh.material as THREE.MeshStandardMaterial;
                material.color.setHex(this.baseColor);
                material.emissive.setHex(0x000000);
            }
        }

        // Retorna suavemente para a posição original (efeito mola)
        this.mesh.position.lerp(this.originalPosition, 3 * delta);
    }
}