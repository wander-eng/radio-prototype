import * as THREE from 'three';
import { InputManager } from './input';
import { Target } from './target';
import { StationId } from './radio';
import type { UIManager } from './hud';

export class Player {
    public mesh: THREE.Mesh;
    private hud: UIManager;
    
    private baseSpeed = 6;
    private baseDamage = 10;
    private baseRange = 1.5;

    public maxHp = 100;
    public hp = 100;

    private lastStation: StationId | null = null;
    
    // Variáveis do motor de Dash
    private isDashing = false;
    private dashTimer = 0;
    private dashCooldown = 0;
    private dashDirection = new THREE.Vector3();
    private timeSinceLastDash = 999;
    private dashHitTargets = new Set<Target>(); 

    // Variáveis do motor de Pulo (NOVO)
    private velocityY = 0;
    private gravity = 30; // Peso da queda
    private jumpForce = 12; // Força do pulo
    private jumpCount = 0;
    private lastSpaceState = false; // Necessário para não pular 2x no mesmo milissegundo

    private attackState: 'idle' | 'windup' | 'recovery' = 'idle';
    private attackStateTimer = 0;
    private timeSinceLastHit = 999;

    private phonkCombo = 0;
    private globalCombo = 0;
    private phonkMaxTriggered = false; 
    private invulnerableTimer = 0; 

    constructor(hud: UIManager) {
        this.hud = hud;
        this.hud.updatePlayerHP(this.hp, this.maxHp);

        const geometry = new THREE.CapsuleGeometry(0.5, 1, 4, 16);
        const material = new THREE.MeshStandardMaterial({ color: 0x0055ff }); 
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.y = 1; 
    }

    public setEmissiveColor(colorHex: number) {
        const material = this.mesh.material as THREE.MeshStandardMaterial;
        material.emissive.setHex(colorHex);
        material.emissiveIntensity = 1.0; 
        material.color.setHex(colorHex); 
    }

    public update(
        delta: number, 
        input: InputManager, 
        camera: THREE.Camera, 
        targets: Target[], 
        currentStation: StationId | null, 
        setTimeScale: (scale: number, duration: number) => void
    ) {
        if (!currentStation) return;

        if (this.lastStation !== currentStation) {
            this.phonkCombo = 0;
            this.globalCombo = 0;
            this.phonkMaxTriggered = false;
            this.hud.updateCombo(0);
            
            if (currentStation === StationId.PHONK) this.hud.setStation('PHONK', '#39FF14');
            if (currentStation === StationId.SAMBA) this.hud.setStation('SAMBA', '#FFD700');
            if (currentStation === StationId.FORRO) this.hud.setStation('FORRÓ', '#FF7F27');

            this.lastStation = currentStation;
        }

        if (this.dashCooldown > 0) this.dashCooldown -= delta;
        if (this.invulnerableTimer > 0) this.invulnerableTimer -= delta;
        this.timeSinceLastDash += delta;
        this.timeSinceLastHit += delta;

        if (this.timeSinceLastHit > 2.0 && this.globalCombo > 0) {
            this.globalCombo = 0;
            this.phonkCombo = 0;
            this.phonkMaxTriggered = false;
            this.hud.updateCombo(0);
        }

        this.handlePhysicsAndJump(delta, input);
        this.handleDash(delta, input, camera, currentStation, targets, setTimeScale);
        this.updateAttackState(delta, input, camera, currentStation, targets);
        
        // ATUALIZADO: Ataque ocorre apenas com MouseLeft, liberando o Espaço
        const wantsToAttack = input.isPressed('MouseLeft');
        if (!this.isDashing && wantsToAttack) {
            this.tryAttack(currentStation, input, camera, targets); 
        }

        this.handleMovement(delta, input, camera, currentStation);
    }

    // --- NOVO: Sistema de Gravidade e Double Jump ---
    private handlePhysicsAndJump(delta: number, input: InputManager) {
        // Se estivermos no dash, suspendemos a gravidade para flutuar para a frente
        if (!this.isDashing) {
            this.velocityY -= this.gravity * delta;
            this.mesh.position.y += this.velocityY * delta;
        } else {
            this.velocityY = 0;
        }

        // Colisão dura com o chão
        if (this.mesh.position.y <= 1.0) {
            this.mesh.position.y = 1.0;
            this.velocityY = 0;
            this.jumpCount = 0; // Reseta os pulos ao tocar o chão
        }

        const currentSpaceState = input.isPressed('Space');
        
        // Verifica se a tecla ACABOU de ser pressionada
        if (currentSpaceState && !this.lastSpaceState) {
            if (this.jumpCount < 2) {
                this.velocityY = this.jumpForce;
                this.jumpCount++;
            }
        }
        
        this.lastSpaceState = currentSpaceState;
    }

    private getMouseDirection(input: InputManager, camera: THREE.Camera, targets: Target[]): THREE.Vector3 {
        if (!input.mousePosition) {
            return new THREE.Vector3(Math.sin(this.mesh.rotation.y), 0, Math.cos(this.mesh.rotation.y));
        }

        const raycaster = new THREE.Raycaster();
        const mousePos = new THREE.Vector2(input.mousePosition.x, input.mousePosition.y);
        raycaster.setFromCamera(mousePos, camera);

        const targetMeshes = targets.filter(t => t.state === 'active').map(t => t.mesh);
        const intersects = raycaster.intersectObjects(targetMeshes);

        if (intersects.length > 0) {
            const hitMesh = intersects[0].object;
            const dir = hitMesh.position.clone().sub(this.mesh.position);
            dir.y = 0; 
            if (dir.lengthSq() > 0) return dir.normalize();
        }

        // Continua mirando no chão em Y = 0 mesmo se o personagem estiver pulando lá no alto
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const targetPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, targetPoint);

        if (targetPoint) {
            const dir = targetPoint.sub(this.mesh.position);
            dir.y = 0;
            if (dir.lengthSq() > 0) return dir.normalize();
        }

        return new THREE.Vector3(Math.sin(this.mesh.rotation.y), 0, Math.cos(this.mesh.rotation.y));
    }

    private handleDash(delta: number, input: InputManager, camera: THREE.Camera, station: StationId, targets: Target[], setTimeScale: (scale: number, duration: number) => void) {
        if (this.isDashing) {
            this.dashTimer -= delta;
            let speedMult = 3; 
            if (station === StationId.FORRO) {
                const inputDir = this.getMovementDirection(input, camera);
                if (inputDir.lengthSq() > 0) {
                    this.dashDirection.lerp(inputDir, 10 * delta).normalize();
                }
                this.executeDashDamage(targets);
            }

            this.mesh.position.add(this.dashDirection.clone().multiplyScalar(this.baseSpeed * speedMult * delta));
            this.mesh.rotation.y = Math.atan2(this.dashDirection.x, this.dashDirection.z);
            if (this.dashTimer <= 0) this.isDashing = false;
            return; 
        }

        const wantsToDash = input.isPressed('ShiftLeft') || input.isPressed('ShiftRight') || input.isPressed('MouseRight');
        
        if (wantsToDash && this.dashCooldown <= 0) {
            let canDash = (this.attackState === 'idle');
            if (station === StationId.PHONK) canDash = true;

            if (canDash) {
                this.isDashing = true;
                this.dashTimer = 0.15;
                this.dashCooldown = 0.4;
                this.timeSinceLastDash = 0;
                this.dashHitTargets.clear();
                
                this.dashDirection.copy(this.getMovementDirection(input, camera));
                if (this.dashDirection.lengthSq() === 0) {
                    this.dashDirection.set(Math.sin(this.mesh.rotation.y), 0, Math.cos(this.mesh.rotation.y)).normalize();
                }

                this.attackState = 'idle';

                if (station === StationId.SAMBA) {
                    this.invulnerableTimer = 0.2;
                    setTimeScale(0.5, 0.15);
                }
            }
        }
    }

    private updateAttackState(delta: number, input: InputManager, camera: THREE.Camera, station: StationId, targets: Target[]) {
        if (this.attackState === 'idle') return;
        this.attackStateTimer -= delta;

        if (this.attackState === 'windup') {
            if (station === StationId.FORRO) {
                const mouseDir = this.getMouseDirection(input, camera, targets);
                const targetRotation = Math.atan2(mouseDir.x, mouseDir.z);
                const currentRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.mesh.rotation.y, 0));
                const targetQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, targetRotation, 0));
                currentRot.slerp(targetQuat, 10 * delta);
                this.mesh.rotation.y = new THREE.Euler().setFromQuaternion(currentRot).y;
            }

            if (this.attackStateTimer <= 0) {
                this.executeHitbox(station, targets);
                this.attackState = 'recovery';
                this.attackStateTimer = station === StationId.FORRO ? 0.6 : 0.3; 
            }
        } else if (this.attackState === 'recovery') {
            if (this.attackStateTimer <= 0) this.attackState = 'idle';
        }
    }

    private tryAttack(station: StationId, input: InputManager, camera: THREE.Camera, targets: Target[]) {
        const snapToMouse = () => {
            const mouseDir = this.getMouseDirection(input, camera, targets);
            this.mesh.rotation.y = Math.atan2(mouseDir.x, mouseDir.z);
        };

        if (this.attackState === 'idle') {
            snapToMouse();
            this.startAttack();
            return;
        }

        if (this.attackState === 'recovery') {
            const maxRecovery = station === StationId.FORRO ? 0.6 : 0.3;
            const timeInRecovery = maxRecovery - this.attackStateTimer;
            let canCombo = false;

            if (station === StationId.PHONK && timeInRecovery >= 0.1) canCombo = true;
            if (station === StationId.SAMBA && timeInRecovery <= 0.25) canCombo = true;
            if (station === StationId.FORRO) canCombo = true;

            if (canCombo) {
                snapToMouse();
                this.startAttack();
            }
        }
    }

    // --- A FUNÇÃO VOLTA AQUI ---
    private startAttack() {
        this.attackState = 'windup';
        this.attackStateTimer = 0.1; 
    }

    private executeHitbox(station: StationId, targets: Target[]) {
        let range = this.baseRange;
        let damage = this.baseDamage;

        if (station === StationId.FORRO) range *= 1.6;

        const playerForward = new THREE.Vector3(Math.sin(this.mesh.rotation.y), 0, Math.cos(this.mesh.rotation.y)).normalize();
        const attackOrigin = this.mesh.position.clone();
        
        const hitCenter = attackOrigin.clone().add(playerForward.clone().multiplyScalar(range));
        const midPoint = attackOrigin.clone().add(playerForward.clone().multiplyScalar(range * 0.5));

        const hits = targets.filter(t => {
            if (t.state !== 'active') return false;
            
            // ATUALIZADO: Ignora a altura (Eixo Y) para que os ataques aéreos acertem inimigos no chão
            const distToCenter = Math.hypot(t.mesh.position.x - hitCenter.x, t.mesh.position.z - hitCenter.z);
            
            if (station === StationId.FORRO) {
                const distToMid = Math.hypot(t.mesh.position.x - midPoint.x, t.mesh.position.z - midPoint.z);
                return distToCenter <= 1.5 || distToMid <= 1.5;
            }
            
            return distToCenter <= 1.5;
        });

        if (hits.length > 0) {
            if (station !== StationId.FORRO) {
                // Também atualizamos a ordenação para ignorar a altura
                hits.sort((a, b) => 
                    Math.hypot(a.mesh.position.x - hitCenter.x, a.mesh.position.z - hitCenter.z) - 
                    Math.hypot(b.mesh.position.x - hitCenter.x, b.mesh.position.z - hitCenter.z)
                );
                hits.length = 1;
            }

            if (station === StationId.FORRO && hits.length >= 2) {
                this.hud.showPopup("ATAQUE EM ÁREA!", "#FF7F27");
            }

            this.globalCombo += hits.length;
            this.hud.updateCombo(this.globalCombo);

            hits.forEach(t => {
                let finalDamage = damage;
                
                if (station === StationId.PHONK) {
                    finalDamage *= (1 + Math.min(this.phonkCombo * 0.05, 0.30));
                }
                
                if (station === StationId.SAMBA && this.timeSinceLastDash <= 1.0) {
                    finalDamage *= 1.5;
                    this.hud.showPopup("CONTRA-ATAQUE!", "#FFD700");
                }

                t.hit(playerForward, finalDamage);
            });

            this.timeSinceLastHit = 0;
            
            if (station === StationId.PHONK) {
                this.phonkCombo++;
                if (this.phonkCombo >= 6 && !this.phonkMaxTriggered) {
                    this.hud.showPopup("DANO MÁXIMO!", "#39FF14");
                    this.phonkMaxTriggered = true;
                }
            }
        } else {
            if (station === StationId.PHONK && this.phonkCombo > 0) {
                this.phonkCombo = 0;
                this.phonkMaxTriggered = false;
                this.globalCombo = 0;
                this.hud.updateCombo(0);
            }
        }
    }

    private executeDashDamage(targets: Target[]) {
        const playerForward = new THREE.Vector3(Math.sin(this.mesh.rotation.y), 0, Math.cos(this.mesh.rotation.y)).normalize();
        targets.forEach(target => {
            // ATUALIZADO: Dash também ignora altura
            const dist = Math.hypot(target.mesh.position.x - this.mesh.position.x, target.mesh.position.z - this.mesh.position.z);
            if (target.state === 'active' && dist <= 1.0) {
                if (!this.dashHitTargets.has(target)) {
                    target.hit(playerForward, this.baseDamage * 0.5); 
                    this.dashHitTargets.add(target);
                }
            }
        });
    }

    private handleMovement(delta: number, input: InputManager, camera: THREE.Camera, station: StationId) {
        if (this.isDashing) return;

        let currentSpeed = this.baseSpeed;
        if (station === StationId.PHONK) currentSpeed = 8.5;
        if (station === StationId.FORRO) currentSpeed = 4.5;

        const moveDir = this.getMovementDirection(input, camera);

        if (moveDir.lengthSq() > 0) {
            // Movimentação ignora Y (Não deixamos o personagem "voar" pra frente ou pra baixo)
            moveDir.y = 0;
            this.mesh.position.add(moveDir.multiplyScalar(currentSpeed * delta));
            if (this.attackState === 'idle') {
                this.mesh.rotation.y = Math.atan2(moveDir.x, moveDir.z);
            }
        }
    }

    private getMovementDirection(input: InputManager, camera: THREE.Camera): THREE.Vector3 {
        const moveDir = new THREE.Vector3();
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        const right = new THREE.Vector3();
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        if (input.isPressed('KeyW') || input.isPressed('ArrowUp')) moveDir.add(forward);
        if (input.isPressed('KeyS') || input.isPressed('ArrowDown')) moveDir.sub(forward);
        if (input.isPressed('KeyA') || input.isPressed('ArrowLeft')) moveDir.sub(right);
        if (input.isPressed('KeyD') || input.isPressed('ArrowRight')) moveDir.add(right);

        if (moveDir.lengthSq() > 0) moveDir.normalize();
        return moveDir;
    }
}