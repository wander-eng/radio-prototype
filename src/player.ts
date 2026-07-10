import * as THREE from 'three';
import { InputManager } from './input';
import { Target } from './target';
import { StationId } from './radio';

export class Player {
    public mesh: THREE.Mesh;
    
    private baseSpeed = 6;
    private baseDamage = 10;
    private baseRange = 1.5;

    private lastStation: StationId | null = null;
    
    private isDashing = false;
    private dashTimer = 0;
    private dashCooldown = 0;
    private dashDirection = new THREE.Vector3();
    private timeSinceLastDash = 999;
    private dashHitTargets = new Set<Target>(); 

    private attackState: 'idle' | 'windup' | 'recovery' = 'idle';
    private attackStateTimer = 0;
    private timeSinceLastHit = 999;

    private phonkCombo = 0;
    private invulnerableTimer = 0; 

    constructor() {
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
            this.lastStation = currentStation;
            console.log(`[RÁDIO] Sintonizado na estação: ${currentStation}`);
        }

        if (this.dashCooldown > 0) this.dashCooldown -= delta;
        if (this.invulnerableTimer > 0) this.invulnerableTimer -= delta;
        this.timeSinceLastDash += delta;
        this.timeSinceLastHit += delta;

        // Phonk: loga a perda de combo por tempo ocioso
        if (currentStation === StationId.PHONK && this.timeSinceLastHit > 2.0 && this.phonkCombo > 0) {
            console.log(`[PHONK] Muito tempo sem bater! Combo resetado.`);
            this.phonkCombo = 0;
        }

        this.handleDash(delta, input, camera, currentStation, targets, setTimeScale);
        this.updateAttackState(delta, input, camera, currentStation, targets);
        
        if (!this.isDashing && input.isPressed('Space')) {
            this.tryAttack(currentStation);
        }

        this.handleMovement(delta, input, camera, currentStation);
    }

    private handleDash(
        delta: number, 
        input: InputManager, 
        camera: THREE.Camera, 
        station: StationId, 
        targets: Target[], 
        setTimeScale: (scale: number, duration: number) => void
    ) {
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

            if (this.dashTimer <= 0) {
                this.isDashing = false;
            }
            return; 
        }

        const wantsToDash = input.isPressed('ShiftLeft') || input.isPressed('ShiftRight');
        
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

                if (station === StationId.PHONK && this.attackState !== 'idle') {
                    console.log(`[PHONK] Animação de ataque cancelada pelo Dash!`);
                }

                this.attackState = 'idle';

                if (station === StationId.SAMBA) {
                    this.invulnerableTimer = 0.2;
                    setTimeScale(0.5, 0.15);
                    console.log(`[SAMBA] Dash! Invulnerabilidade e Câmera Lenta ativados.`);
                }
            }
        }
    }

    private updateAttackState(delta: number, input: InputManager, camera: THREE.Camera, station: StationId, targets: Target[]) {
        if (this.attackState === 'idle') return;

        this.attackStateTimer -= delta;

        if (this.attackState === 'windup') {
            if (station === StationId.FORRO) {
                const inputDir = this.getMovementDirection(input, camera);
                if (inputDir.lengthSq() > 0) {
                    const targetRotation = Math.atan2(inputDir.x, inputDir.z);
                    const currentRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.mesh.rotation.y, 0));
                    const targetQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, targetRotation, 0));
                    currentRot.slerp(targetQuat, 10 * delta);
                    this.mesh.rotation.y = new THREE.Euler().setFromQuaternion(currentRot).y;
                }
            }

            if (this.attackStateTimer <= 0) {
                this.executeHitbox(station, targets);
                this.attackState = 'recovery';
                this.attackStateTimer = 0.3; 
                if (station === StationId.FORRO) this.attackStateTimer = 0.6; 
            }
        } else if (this.attackState === 'recovery') {
            if (this.attackStateTimer <= 0) {
                this.attackState = 'idle';
            }
        }
    }

    private tryAttack(station: StationId) {
        if (this.attackState === 'idle') {
            this.startAttack();
            return;
        }

        if (this.attackState === 'recovery') {
            const maxRecovery = station === StationId.FORRO ? 0.6 : 0.3;
            const timeInRecovery = maxRecovery - this.attackStateTimer;
            
            let canCombo = false;

            if (station === StationId.PHONK && timeInRecovery >= 0.1) canCombo = true;
            
            if (station === StationId.SAMBA) {
                if (timeInRecovery <= 0.25) {
                    canCombo = true;
                } else {
                    // Loga a punição visualmente se o input vier atrasado
                    console.log(`[SAMBA] Errou o timing do combo! Atraso punido.`);
                    return; 
                }
            }

            if (station === StationId.FORRO) canCombo = true;

            if (canCombo) {
                this.startAttack();
            }
        }
    }

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
        const hitCenter = attackOrigin.add(playerForward.clone().multiplyScalar(range));

        const hits = targets.filter(t => t.mesh.position.distanceTo(hitCenter) <= 1.5);

        if (hits.length > 0) {
            if (station !== StationId.FORRO) {
                hits.sort((a, b) => a.mesh.position.distanceTo(hitCenter) - b.mesh.position.distanceTo(hitCenter));
                hits.length = 1;
            }

            hits.forEach(t => {
                let finalDamage = damage;
                let logMsg = '';
                
                if (station === StationId.PHONK) {
                    const bonus = Math.min(this.phonkCombo * 0.05, 0.30);
                    finalDamage *= (1 + bonus);
                    logMsg = `[PHONK] Hit! Combo: ${this.phonkCombo} | Dano: ${finalDamage.toFixed(1)} (+${(bonus*100).toFixed(0)}%)`;
                }
                
                if (station === StationId.SAMBA) {
                    if (this.timeSinceLastDash <= 1.0) {
                        finalDamage *= 1.5;
                        logMsg = `[SAMBA] CONTRA-ATAQUE CRÍTICO! Dano: ${finalDamage.toFixed(1)}`;
                    } else {
                        logMsg = `[SAMBA] Hit Normal. Dano: ${finalDamage.toFixed(1)}`;
                    }
                }

                if (station === StationId.FORRO) {
                    logMsg = `[FORRO] Dano em Área! Dano: ${finalDamage.toFixed(1)}`;
                }

                t.hit(playerForward, finalDamage);
                console.log(logMsg);
            });

            this.timeSinceLastHit = 0;
            if (station === StationId.PHONK) this.phonkCombo++;
        } else {
            // Regra Phonk: Errar o vento reseta
            if (station === StationId.PHONK && this.phonkCombo > 0) {
                this.phonkCombo = 0;
                console.log(`[PHONK] Errou o ataque! Combo resetado para 0.`);
            }
        }
    }

    private executeDashDamage(targets: Target[]) {
        const playerForward = new THREE.Vector3(Math.sin(this.mesh.rotation.y), 0, Math.cos(this.mesh.rotation.y)).normalize();
        targets.forEach(target => {
            if (target.mesh.position.distanceTo(this.mesh.position) <= 1.0) {
                if (!this.dashHitTargets.has(target)) {
                    target.hit(playerForward, this.baseDamage * 0.5); 
                    this.dashHitTargets.add(target);
                    console.log(`[FORRO] Dano de atropelamento pelo Dash! Dano: ${(this.baseDamage * 0.5).toFixed(1)}`);
                }
            }
        });
    }

    private handleMovement(delta: number, input: InputManager, camera: THREE.Camera, station: StationId) {
        // Bloqueia movimentação APENAS durante o dash. Fluidez total (kiting) restaurada durante os ataques.
        if (this.isDashing) return;

        // Diferenças drásticas de velocidade baseadas na estação
        let currentSpeed = this.baseSpeed; // 6.0
        if (station === StationId.PHONK) currentSpeed = 8.5;
        if (station === StationId.FORRO) currentSpeed = 4.5;

        const moveDir = this.getMovementDirection(input, camera);

        if (moveDir.lengthSq() > 0) {
            this.mesh.position.add(moveDir.multiplyScalar(currentSpeed * delta));
            this.mesh.rotation.y = Math.atan2(moveDir.x, moveDir.z);
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

        if (input.isPressed('KeyW')) moveDir.add(forward);
        if (input.isPressed('KeyS')) moveDir.sub(forward);
        if (input.isPressed('KeyA')) moveDir.sub(right);
        if (input.isPressed('KeyD')) moveDir.add(right);

        if (moveDir.lengthSq() > 0) moveDir.normalize();
        return moveDir;
    }
}