import * as THREE from 'three';
import { StationId } from './radio';
import type { FollowCamera } from './camera';

export class EffectsManager {
    private scene: THREE.Scene;
    private cameraSystem: FollowCamera;
    
    // Estado da Câmera
    private activeCameraEffect: StationId | null = null;
    private cameraTimer = 0;

    // Estado das Partículas
    private activeSpawners: { type: StationId, timer: number }[] = [];
    private particleSystems: { mesh: THREE.Points, velocities?: THREE.Vector3[], life: number, maxLife: number }[] = [];

    constructor(scene: THREE.Scene, cameraSystem: FollowCamera) {
        this.scene = scene;
        this.cameraSystem = cameraSystem;
    }

    public playStationSwitchEffect(station: StationId, playerPos: THREE.Vector3) {
        this.activeCameraEffect = station;
        this.cameraTimer = 0;

        // Limpa qualquer efeito residual da câmera imediatamente
        this.cameraSystem.lerpSpeed = 5;
        this.cameraSystem.positionalOffset.set(0, 0, 0);
        this.cameraSystem.angularOffset = 0;
        this.cameraSystem.camera.fov = this.cameraSystem.baseFov;
        this.cameraSystem.camera.updateProjectionMatrix();

        if (station === StationId.PHONK) {
            // Câmera: Zoom-punch instântaneo (reduz FOV para criar impacto)
            this.cameraSystem.camera.fov = 55; 
            this.cameraSystem.camera.updateProjectionMatrix();
            // Partículas: Burst explosivo
            this.spawnPhonkBurst(playerPos);
        } else if (station === StationId.SAMBA) {
            // Câmera: Nudge lateral + hesitação no lerp
            this.cameraSystem.positionalOffset.set(2, 0, 0); 
            this.cameraSystem.lerpSpeed = 1.0; 
            // Partículas: Inicia o rastro prolongado
            this.activeSpawners.push({ type: StationId.SAMBA, timer: 1.0 });
        } else if (station === StationId.FORRO) {
            // Câmera: Rotação orbital
            this.cameraSystem.angularOffset = Math.PI / 8; // Gira ~22.5 graus
            // Partículas: Inicia rastro circular
            this.activeSpawners.push({ type: StationId.FORRO, timer: 1.0 });
        }
    }

    public update(unscaledDelta: number, playerPos: THREE.Vector3) {
        // Usamos unscaledDelta para que a câmera lenta do jogo não afete o "Juice" da UI/Câmera
        this.updateCameraEffects(unscaledDelta);
        this.updateSpawners(unscaledDelta, playerPos);
        this.updateParticles(unscaledDelta);
    }

    private updateCameraEffects(delta: number) {
        if (!this.activeCameraEffect) return;
        this.cameraTimer += delta;

        if (this.activeCameraEffect === StationId.PHONK) {
            // Retorna o FOV suavemente ao normal
            this.cameraSystem.camera.fov = THREE.MathUtils.lerp(this.cameraSystem.camera.fov, this.cameraSystem.baseFov, 15 * delta);
            this.cameraSystem.camera.updateProjectionMatrix();
            if (this.cameraTimer > 0.15) {
                this.cameraSystem.camera.fov = this.cameraSystem.baseFov;
                this.cameraSystem.camera.updateProjectionMatrix();
                this.activeCameraEffect = null;
            }
        } else if (this.activeCameraEffect === StationId.SAMBA) {
            // Retorna o Nudge para zero
            this.cameraSystem.positionalOffset.lerp(new THREE.Vector3(0, 0, 0), 10 * delta);
            if (this.cameraTimer > 0.1) {
                this.cameraSystem.lerpSpeed = 5; // Restaura a velocidade de rastreamento
                if (this.cameraTimer > 0.3) this.activeCameraEffect = null;
            }
        } else if (this.activeCameraEffect === StationId.FORRO) {
            // Retorna a rotação orbital para zero
            this.cameraSystem.angularOffset = THREE.MathUtils.lerp(this.cameraSystem.angularOffset, 0, 8 * delta);
            if (this.cameraTimer > 0.3) {
                this.cameraSystem.angularOffset = 0;
                this.activeCameraEffect = null;
            }
        }
    }

    private spawnPhonkBurst(pos: THREE.Vector3) {
        const count = 60;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const velocities: THREE.Vector3[] = [];

        for (let i = 0; i < count; i++) {
            positions[i * 3] = pos.x;
            positions[i * 3 + 1] = pos.y + 0.5;
            positions[i * 3 + 2] = pos.z;

            // Velocidade radial aleatória
            const v = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            ).normalize().multiplyScalar(5 + Math.random() * 8);
            velocities.push(v);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({ color: 0x39FF14, size: 0.2, transparent: true });
        const mesh = new THREE.Points(geometry, material);
        
        this.scene.add(mesh);
        this.particleSystems.push({ mesh, velocities, life: 0, maxLife: 0.4 });
    }

    private updateSpawners(delta: number, playerPos: THREE.Vector3) {
        for (let i = this.activeSpawners.length - 1; i >= 0; i--) {
            const spawner = this.activeSpawners[i];
            spawner.timer -= delta;

            if (spawner.type === StationId.SAMBA) {
                this.spawnTrailPoint(playerPos, 0xFFD700, 0.6, false);
            } else if (spawner.type === StationId.FORRO) {
                this.spawnTrailPoint(playerPos, 0xFF7F27, 0.8, true);
            }

            if (spawner.timer <= 0) {
                this.activeSpawners.splice(i, 1);
            }
        }
    }

    private spawnTrailPoint(pos: THREE.Vector3, color: number, maxLife: number, isCircular: boolean) {
        const geometry = new THREE.BufferGeometry();
        const offset = new THREE.Vector3();
        
        if (isCircular) {
            // Forró: Posição circular ao redor do personagem
            const angle = Math.random() * Math.PI * 2;
            const radius = 1.8;
            offset.set(Math.cos(angle) * radius, (Math.random() - 0.5) + 0.5, Math.sin(angle) * radius);
        } else {
            // Samba: Rastro espalhado na base e rastro principal
            offset.set((Math.random() - 0.5), Math.random() * 1.5, (Math.random() - 0.5));
        }

        const finalPos = pos.clone().add(offset);
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([finalPos.x, finalPos.y, finalPos.z], 3));
        
        const material = new THREE.PointsMaterial({ color, size: 0.15, transparent: true, opacity: 1 });
        const mesh = new THREE.Points(geometry, material);
        
        this.scene.add(mesh);
        this.particleSystems.push({ mesh, life: 0, maxLife });
    }

    private updateParticles(delta: number) {
        for (let i = this.particleSystems.length - 1; i >= 0; i--) {
            const ps = this.particleSystems[i];
            ps.life += delta;

            // Se for o burst do Phonk, aplica a velocidade
            if (ps.velocities) {
                const positions = ps.mesh.geometry.attributes.position.array as Float32Array;
                for (let j = 0; j < ps.velocities.length; j++) {
                    positions[j * 3] += ps.velocities[j].x * delta;
                    positions[j * 3 + 1] += ps.velocities[j].y * delta;
                    positions[j * 3 + 2] += ps.velocities[j].z * delta;
                }
                ps.mesh.geometry.attributes.position.needsUpdate = true;
            }

            // Faz o fade-out baseado no tempo de vida
            const material = ps.mesh.material as THREE.PointsMaterial;
            const progress = ps.life / ps.maxLife;
            material.opacity = 1 - progress;

            if (ps.life >= ps.maxLife) {
                this.scene.remove(ps.mesh);
                ps.mesh.geometry.dispose();
                material.dispose();
                this.particleSystems.splice(i, 1);
            }
        }
    }
}