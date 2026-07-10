import * as THREE from 'three';

export class Target {
    public mesh: THREE.Mesh;
    private baseColor = 0xb22222;
    private flashColor = 0xffffff;
    private flashTimer = 0;
    private originalPosition: THREE.Vector3;
    
    // Adicionamos uma variável para registrar o dano acumulado e validar o uso do parâmetro
    private totalDamageTaken = 0; 

    constructor(position: THREE.Vector3) {
        const geometry = new THREE.BoxGeometry(1, 2, 1);
        const material = new THREE.MeshStandardMaterial({ color: this.baseColor });
        this.mesh = new THREE.Mesh(geometry, material);
        
        this.mesh.position.copy(position);
        this.mesh.position.y = 1; 
        this.originalPosition = this.mesh.position.clone();
    }

    public hit(direction: THREE.Vector3, damage: number = 10) {
        // O valor agora é lido e o TypeScript para de reclamar
        this.totalDamageTaken += damage; 

        this.flashTimer = 0.1;
        const material = this.mesh.material as THREE.MeshStandardMaterial;
        material.color.setHex(this.flashColor);
        material.emissive.setHex(0x555555);

        const knockbackForce = direction.clone().normalize().multiplyScalar(0.8);
        this.mesh.position.add(knockbackForce);
    }

    public update(delta: number) {
        if (this.flashTimer > 0) {
            this.flashTimer -= delta;
            if (this.flashTimer <= 0) {
                const material = this.mesh.material as THREE.MeshStandardMaterial;
                material.color.setHex(this.baseColor);
                material.emissive.setHex(0x000000);
            }
        }
        this.mesh.position.lerp(this.originalPosition, 3 * delta);
    }
}