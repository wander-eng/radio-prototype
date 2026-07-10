import * as THREE from 'three';

export class Target {
    public mesh: THREE.Mesh;
    private baseColor = 0xb22222;
    private flashColor = 0xffffff;
    private flashTimer = 0;
    private originalPosition: THREE.Vector3;
    
    // Status e Ciclo de Vida
    public state: 'active' | 'dying' | 'dead' = 'active';
    public hp = 100;
    public maxHp = 100;
    private respawnTimer = 0;

    // HUD do Alvo
    private hpBarContainer: HTMLDivElement;
    private hpBarFill: HTMLDivElement;

    constructor(position: THREE.Vector3) {
        const geometry = new THREE.BoxGeometry(1, 2, 1);
        const material = new THREE.MeshStandardMaterial({ color: this.baseColor });
        this.mesh = new THREE.Mesh(geometry, material);
        
        this.mesh.position.copy(position);
        this.mesh.position.y = 1; 
        this.originalPosition = this.mesh.position.clone();

        // Cria a barra de HP HTML para este alvo
        this.hpBarContainer = document.createElement('div');
        this.hpBarContainer.className = 'target-hp-container';
        this.hpBarFill = document.createElement('div');
        this.hpBarFill.className = 'target-hp-fill';
        this.hpBarContainer.appendChild(this.hpBarFill);
        document.body.appendChild(this.hpBarContainer);
    }

    public hit(direction: THREE.Vector3, damage: number = 10) {
        if (this.state !== 'active') return;

        this.hp -= damage;
        this.updateHpBar();

        if (this.hp <= 0) {
            this.hp = 0;
            this.state = 'dying';
            this.hpBarContainer.style.display = 'none'; // Esconde a barra ao morrer
            return;
        }

        this.flashTimer = 0.1;
        const material = this.mesh.material as THREE.MeshStandardMaterial;
        material.color.setHex(this.flashColor);
        material.emissive.setHex(0x555555);

        const knockbackForce = direction.clone().normalize().multiplyScalar(0.8);
        this.mesh.position.add(knockbackForce);
    }

    public update(delta: number, camera: THREE.Camera) {
        if (this.state === 'dying') {
            // Animação de destruição (encolhe até sumir em ~0.3s)
            this.mesh.scale.lerp(new THREE.Vector3(0, 0, 0), 10 * delta);
            if (this.mesh.scale.y < 0.05) {
                this.mesh.visible = false;
                this.state = 'dead';
                this.respawnTimer = 2.0; // 2 segundos para renascer
            }
            return;
        }

        if (this.state === 'dead') {
            this.respawnTimer -= delta;
            if (this.respawnTimer <= 0) {
                this.respawn();
            }
            return;
        }

        // Estado 'active': Projeta a posição 3D para 2D (Tela) para colar a barra de HP
        const screenPos = this.mesh.position.clone();
        screenPos.y += 1.5; // Fica acima da cabeça
        screenPos.project(camera);

        // Se o alvo estiver atrás da câmera, esconde a barra
        if (screenPos.z > 1) {
            this.hpBarContainer.style.display = 'none';
        } else {
            this.hpBarContainer.style.display = 'block';
            const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
            const y = -(screenPos.y * 0.5 - 0.5) * window.innerHeight;
            this.hpBarContainer.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
        }

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

    private respawn() {
        this.state = 'active';
        this.hp = this.maxHp;
        this.mesh.visible = true;
        this.mesh.scale.set(1, 1, 1);
        this.mesh.position.copy(this.originalPosition);
        this.updateHpBar();
    }

    private updateHpBar() {
        const pct = Math.max(0, (this.hp / this.maxHp) * 100);
        this.hpBarFill.style.width = `${pct}%`;
    }
}