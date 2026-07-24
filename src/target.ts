import * as THREE from 'three';
import type { CombatHitResult, CombatTarget, CombatTargetState } from './combat-target';
import { applyDamageToHp } from './combat-math';
import type { ImpactEvent, ImpactTargetResult } from './impact-event';
import {
    clampReactionPosition,
    LocalImpactReaction,
    type ImpactReactive,
    type ImpactReactionSnapshot
} from './impact-reaction';

export class Target implements CombatTarget, ImpactReactive {
    public readonly id: string;
    public mesh: THREE.Mesh;
    private baseColor = 0xb22222;
    private readonly impactReaction = new LocalImpactReaction();
    private originalPosition: THREE.Vector3;
    
    // Status e Ciclo de Vida
    public state: CombatTargetState = 'active';
    public hp = 100;
    public readonly maxHp = 100;
    private respawnTimer = 0;

    // HUD do Alvo
    private hpBarContainer: HTMLDivElement;
    private hpBarFill: HTMLDivElement;

    constructor(id: string, position: THREE.Vector3) {
        this.id = id;
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

    public receiveHit(_direction: THREE.Vector3, damage: number = 10): CombatHitResult {
        if (this.state !== 'active') {
            return { applied: false, killed: false, damageAccepted: 0 };
        }

        const result = applyDamageToHp(this.hp, damage, this.maxHp);
        if (result.damageApplied === 0) {
            return { applied: false, killed: false, damageAccepted: 0 };
        }

        this.hp = result.hp;
        this.updateHpBar();

        if (result.killed) {
            this.state = 'dying';
            this.hpBarContainer.style.display = 'none'; // Esconde a barra ao morrer
            return { applied: true, killed: true, damageAccepted: result.damageApplied };
        }

        return { applied: true, killed: false, damageAccepted: result.damageApplied };
    }

    public get impactReactionSnapshot(): ImpactReactionSnapshot {
        return this.impactReaction.snapshot;
    }

    public applyImpactReaction(event: ImpactEvent, target: ImpactTargetResult) {
        if (target.targetId !== this.id || target.damageAccepted <= 0) return;
        this.impactReaction.trigger(event, true);
        this.applyLogicalAppearance();
    }

    public updateImpactReaction(
        presentationDeltaSeconds: number,
        gameplayDeltaSeconds: number
    ) {
        const displacement = this.impactReaction.update(
            presentationDeltaSeconds,
            gameplayDeltaSeconds
        );
        const nextPosition = clampReactionPosition({
            x: this.mesh.position.x + displacement.x,
            y: this.mesh.position.y,
            z: this.mesh.position.z + displacement.z
        });
        this.mesh.position.set(nextPosition.x, nextPosition.y, nextPosition.z);
        this.applyLogicalAppearance();
        return displacement;
    }

    public resetImpactReaction() {
        this.impactReaction.reset();
        this.applyLogicalAppearance();
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

        if (!this.impactReactionSnapshot.knockbackActive) {
            this.mesh.position.lerp(this.originalPosition, 3 * delta);
        }
    }

    private respawn() {
        this.resetImpactReaction();
        this.state = 'active';
        this.hp = this.maxHp;
        this.mesh.visible = true;
        this.mesh.scale.set(1, 1, 1);
        this.mesh.position.copy(this.originalPosition);
        this.updateHpBar();
    }

    private applyLogicalAppearance() {
        const material = this.mesh.material as THREE.MeshStandardMaterial;
        const reaction = this.impactReactionSnapshot;
        if (reaction.flashActive) {
            material.color.setHex(0xffffff);
            material.emissive.setRGB(
                reaction.flashIntensity,
                reaction.flashIntensity,
                reaction.flashIntensity
            );
            material.emissiveIntensity = 1;
            return;
        }
        material.color.setHex(this.baseColor);
        material.emissive.setHex(0x000000);
        material.emissiveIntensity = 0;
    }

    private updateHpBar() {
        const pct = Math.max(0, (this.hp / this.maxHp) * 100);
        this.hpBarFill.style.width = `${pct}%`;
    }
}
