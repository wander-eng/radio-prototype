import * as THREE from 'three';
import { StationId } from './radio';
import type { FollowCamera } from './camera';

export class EffectsManager {
    private scene: THREE.Scene;
    private cameraSystem: FollowCamera;
    
    // Estado da Câmera
    private activeCameraEffect: StationId | null = null;
    private cameraTimer = 0;

    // Estado das Partículas de Troca (Trilhas e Burst)
    private activeSpawners: { type: StationId, timer: number }[] = [];
    private particleSystems: { mesh: THREE.Points, velocities?: THREE.Vector3[], life: number, maxLife: number }[] = [];
    
    // NOVO: Estado dos Confetes (Samba Switch)
    private confettiSystems: { group: THREE.Group, meshes: { mesh: THREE.Mesh, vel: THREE.Vector3, rot: THREE.Vector3 }[], life: number, maxLife: number }[] = [];

    // NOVO: Estado da Aura Contínua
    private auraParticles: { mesh: THREE.Points, life: number, maxLife: number, type: StationId, angle: number, radius: number, baseY: number, baseSize: number }[] = [];
    private auraTimer = 0;

    constructor(scene: THREE.Scene, cameraSystem: FollowCamera) {
        this.scene = scene;
        this.cameraSystem = cameraSystem;
    }

    public playStationSwitchEffect(station: StationId, playerPos: THREE.Vector3) {
        this.activeCameraEffect = station;
        this.cameraTimer = 0;

        // Limpa efeito residual
        this.cameraSystem.lerpSpeed = 5;
        this.cameraSystem.positionalOffset.set(0, 0, 0);
        this.cameraSystem.angularOffset = 0;
        this.cameraSystem.camera.fov = this.cameraSystem.baseFov;
        this.cameraSystem.camera.updateProjectionMatrix();

        if (station === StationId.PHONK) {
            // Intocado conforme especificação
            this.cameraSystem.camera.fov = 55; 
            this.cameraSystem.camera.updateProjectionMatrix();
            this.spawnPhonkBurst(playerPos);
        } else if (station === StationId.SAMBA) {
            // Câmera: Nudge muito mais agressivo
            this.cameraSystem.positionalOffset.set(5, 0, 0); 
            this.cameraSystem.lerpSpeed = 0.5; // Cai drasticamente a velocidade (hesitação forte)
            
            // Partícula: Confete/Serpentina
            this.spawnSambaConfetti(playerPos);
        } else if (station === StationId.FORRO) {
            // Câmera: Rotação orbital intensa + Zoom-in
            this.cameraSystem.angularOffset = Math.PI / 3; // Giro de 60 graus
            this.cameraSystem.positionalOffset.set(0, -1, -3); // Zoom (avança no Z, desce no Y)
            
            // Partícula de troca (mantido)
            this.activeSpawners.push({ type: StationId.FORRO, timer: 1.0 });
        }
    }

    public update(unscaledDelta: number, playerPos: THREE.Vector3, currentStation: StationId | null, auraIntensity: number) {
        this.updateCameraEffects(unscaledDelta);
        this.updateSpawners(unscaledDelta, playerPos);
        this.updateParticles(unscaledDelta);
        this.updateConfetti(unscaledDelta);
        this.updateContinuousAura(unscaledDelta, playerPos, currentStation, auraIntensity);
    }

    private updateCameraEffects(delta: number) {
        if (!this.activeCameraEffect) return;
        this.cameraTimer += delta;

        if (this.activeCameraEffect === StationId.PHONK) {
            this.cameraSystem.camera.fov = THREE.MathUtils.lerp(this.cameraSystem.camera.fov, this.cameraSystem.baseFov, 15 * delta);
            this.cameraSystem.camera.updateProjectionMatrix();
            if (this.cameraTimer > 0.15) {
                this.cameraSystem.camera.fov = this.cameraSystem.baseFov;
                this.cameraSystem.camera.updateProjectionMatrix();
                this.activeCameraEffect = null;
            }
        } else if (this.activeCameraEffect === StationId.SAMBA) {
            // Suaviza o retorno do Nudge
            this.cameraSystem.positionalOffset.lerp(new THREE.Vector3(0, 0, 0), 8 * delta);
            
            // Estende a duração da queda de velocidade do lerp (agora para ~200ms+)
            if (this.cameraTimer > 0.2) {
                this.cameraSystem.lerpSpeed = THREE.MathUtils.lerp(this.cameraSystem.lerpSpeed, 5, 8 * delta);
                if (this.cameraTimer > 0.6) {
                    this.cameraSystem.lerpSpeed = 5;
                    this.activeCameraEffect = null;
                }
            }
        } else if (this.activeCameraEffect === StationId.FORRO) {
            // Retorna rotação e zoom pro normal
            this.cameraSystem.angularOffset = THREE.MathUtils.lerp(this.cameraSystem.angularOffset, 0, 6 * delta);
            this.cameraSystem.positionalOffset.lerp(new THREE.Vector3(0, 0, 0), 6 * delta);
            if (this.cameraTimer > 0.5) {
                this.cameraSystem.angularOffset = 0;
                this.cameraSystem.positionalOffset.set(0, 0, 0);
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

    private spawnSambaConfetti(pos: THREE.Vector3) {
        const count = 35; // Quantidade solta para não ficar densa demais
        const group = new THREE.Group();
        group.position.copy(pos);
        group.position.y += 1.0; 

        // Paleta festiva (maioria dourado, alguns brancos/cremes)
        const colors = [0xFFD700, 0xFFD700, 0xFFFFFF, 0xFFF8DC, 0xFFD700];
        const meshes: { mesh: THREE.Mesh, vel: THREE.Vector3, rot: THREE.Vector3 }[] = [];

        // Geometria alongada simulando pedaços de fita/serpentina
        const geometry = new THREE.PlaneGeometry(0.05, 0.25); 

        for (let i = 0; i < count; i++) {
            const color = colors[Math.floor(Math.random() * colors.length)];
            const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
            const mesh = new THREE.Mesh(geometry, material);

            mesh.position.set(
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5
            );

            // Explosão radial, com prioridade vertical inicial
            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 6,
                Math.random() * 5 + 3,
                (Math.random() - 0.5) * 6
            );

            const rot = new THREE.Vector3(
                Math.random() * 10 - 5,
                Math.random() * 10 - 5,
                Math.random() * 10 - 5
            );

            group.add(mesh);
            meshes.push({ mesh, vel, rot });
        }

        this.scene.add(group);
        this.confettiSystems.push({ group, meshes, life: 0, maxLife: 1.0 }); // Duração festiva estendida
    }

    private updateSpawners(delta: number, playerPos: THREE.Vector3) {
        for (let i = this.activeSpawners.length - 1; i >= 0; i--) {
            const spawner = this.activeSpawners[i];
            spawner.timer -= delta;

            if (spawner.type === StationId.FORRO) {
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
            const angle = Math.random() * Math.PI * 2;
            const radius = 1.8;
            offset.set(Math.cos(angle) * radius, (Math.random() - 0.5) + 0.5, Math.sin(angle) * radius);
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

            if (ps.velocities) {
                const positions = ps.mesh.geometry.attributes.position.array as Float32Array;
                for (let j = 0; j < ps.velocities.length; j++) {
                    positions[j * 3] += ps.velocities[j].x * delta;
                    positions[j * 3 + 1] += ps.velocities[j].y * delta;
                    positions[j * 3 + 2] += ps.velocities[j].z * delta;
                }
                ps.mesh.geometry.attributes.position.needsUpdate = true;
            }

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

    private updateConfetti(delta: number) {
        for (let i = this.confettiSystems.length - 1; i >= 0; i--) {
            const sys = this.confettiSystems[i];
            sys.life += delta;
            const progress = sys.life / sys.maxLife;

            for (let c of sys.meshes) {
                // Gravidade
                c.vel.y -= delta * 8.0; 
                // Atrito forte lateral (simula papel caindo em zigue-zague)
                c.vel.x *= 0.95; 
                c.vel.z *= 0.95;

                c.mesh.position.addScaledVector(c.vel, delta);
                
                // Rotação turbulenta no ar
                c.mesh.rotation.x += c.rot.x * delta;
                c.mesh.rotation.y += c.rot.y * delta;
                c.mesh.rotation.z += c.rot.z * delta;

                // Fade-out limpo no final
                const mat = c.mesh.material as THREE.MeshBasicMaterial;
                if (progress > 0.7) {
                    mat.transparent = true;
                    mat.opacity = 1 - ((progress - 0.7) / 0.3);
                }
            }

            if (sys.life >= sys.maxLife) {
                this.scene.remove(sys.group);
                for (let c of sys.meshes) {
                    c.mesh.geometry.dispose();
                    (c.mesh.material as THREE.Material).dispose();
                }
                this.confettiSystems.splice(i, 1);
            }
        }
    }

    private updateContinuousAura(delta: number, playerPos: THREE.Vector3, currentStation: StationId | null, intensity: number) {
        const normalizedIntensity = THREE.MathUtils.clamp(intensity, 0, 1);
        
        // Taxas de spawn ditam a densidade da aura
        const spawnRates = {
            [StationId.PHONK]: 0.02, // 50/s (Intenso e denso)
            [StationId.SAMBA]: 0.1,  // 10/s (Poucas, soltas)
            [StationId.FORRO]: 0.04  // 25/s (Visível, circular)
        };

        if (currentStation && normalizedIntensity > 0) {
            this.auraTimer += delta;
            const spawnInterval = spawnRates[currentStation] / normalizedIntensity;

            if (this.auraTimer > spawnInterval) {
                this.auraTimer = 0;
                this.spawnAuraParticle(currentStation, playerPos, normalizedIntensity);
            }
        } else {
            this.auraTimer = 0;
        }

        // Move a aura atrelada matematicamente ao centro do jogador
        for (let i = this.auraParticles.length - 1; i >= 0; i--) {
            const p = this.auraParticles[i];
            p.life += delta;

            if (p.type === StationId.PHONK) {
                // Pulsação agressiva para fora e para cima
                p.radius += delta * 1.5; 
                p.baseY += delta * 2.0; 
                const x = playerPos.x + Math.cos(p.angle) * p.radius;
                const z = playerPos.z + Math.sin(p.angle) * p.radius;
                // Jitter garante visual "instável/nervoso"
                const jitterX = (Math.random() - 0.5) * 0.1 * normalizedIntensity;
                const jitterZ = (Math.random() - 0.5) * 0.1 * normalizedIntensity;
                p.mesh.position.set(x + jitterX, playerPos.y + p.baseY, z + jitterZ);
            } 
            else if (p.type === StationId.SAMBA) {
                // Sinuosa (senoide), serpenteia para cima
                p.baseY += delta * 1.0; 
                const osc = Math.sin(p.life * Math.PI * 3) * 0.4 * normalizedIntensity;
                const currentRadius = p.radius + osc;
                const x = playerPos.x + Math.cos(p.angle) * currentRadius;
                const z = playerPos.z + Math.sin(p.angle) * currentRadius;
                p.mesh.position.set(x, playerPos.y + p.baseY, z);
            } 
            else if (p.type === StationId.FORRO) {
                // Espiral rodopiante contínua
                p.angle += delta * 8.0; 
                p.baseY += delta * 1.2; 
                const currentRadius = p.radius + Math.sin(p.life * 15) * 0.1 * normalizedIntensity; // Oscilação leve
                const x = playerPos.x + Math.cos(p.angle) * currentRadius;
                const z = playerPos.z + Math.sin(p.angle) * currentRadius;
                p.mesh.position.set(x, playerPos.y + p.baseY, z);
            }

            const material = p.mesh.material as THREE.PointsMaterial;
            material.opacity = (1 - (p.life / p.maxLife)) * normalizedIntensity;
            material.size = p.baseSize * normalizedIntensity;

            if (p.life >= p.maxLife) {
                this.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                material.dispose();
                this.auraParticles.splice(i, 1);
            }
        }
    }

    private spawnAuraParticle(station: StationId, pos: THREE.Vector3, intensity: number) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
        
        let color = 0xffffff;
        let size = 0.1;
        let maxLife = 0.5;
        let radius = 0.5;
        let angle = Math.random() * Math.PI * 2;
        let baseY = Math.random() * 1.0;

        if (station === StationId.PHONK) {
            color = 0x39FF14; 
            size = 0.15;
            maxLife = 0.3; 
            radius = 0.4 + Math.random() * 0.2; 
        } else if (station === StationId.SAMBA) {
            color = 0xFFD700; 
            size = 0.12;
            maxLife = 1.0; 
            radius = 0.6 + Math.random() * 0.4;
        } else if (station === StationId.FORRO) {
            color = 0xFF7F27; 
            size = 0.12;
            maxLife = 0.6;
            radius = 0.8 + Math.random() * 0.3; 
        }

        const material = new THREE.PointsMaterial({
            color,
            size: size * intensity,
            transparent: true,
            opacity: intensity
        });
        const mesh = new THREE.Points(geometry, material);
        
        // O valor agora é lido e a partícula já nasce no lugar certo!
        mesh.position.copy(pos);
        
        this.scene.add(mesh);
        this.auraParticles.push({
            mesh, life: 0, maxLife, type: station, angle, radius, baseY, baseSize: size
        });
    }
}
