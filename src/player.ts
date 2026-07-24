import * as THREE from 'three';
import { InputManager } from './input';
import type { CombatTarget } from './combat-target';
import { StationId } from './radio';
import type { UIManager } from './hud';
// NOVO: Importação das funções matemáticas extraídas
import {
    forroSweepHit,
    phonkDamageMultiplier,
    resolvePlayerAttack,
    sambaDamage,
    updateInvulnerabilityTimer
} from './combat-math';
import type { PlayerAttackDecision } from './combat-math';
import {
    createImpactEvent,
    createLocalImpactDependencies,
    type ImpactContext,
    type ImpactEventDependencies,
    type ImpactStation,
    type ImpactTargetResult
} from './impact-event';
import {
    classifyOffensiveImpact,
    phonkImpactReachesDamageCap
} from './impact-math';
import type { ImpactEvent } from './impact-event';
import {
    LocalImpactReaction,
    type ImpactReactive,
    type ImpactReactionSnapshot
} from './impact-reaction';
import {
    decideForroDashEnergy,
    decideSambaCounterHit,
    resolveAttackAim,
    updateCombatWindow
} from './station-combat-math';

const DAMAGE_INVULNERABILITY_SECONDS = 0.5;

export class Player implements ImpactReactive {
    public mesh: THREE.Mesh;
    private hud: UIManager;
    private onEnergyHit: (successfulHitCount: number) => void;
    private onSambaDodge: () => void;
    
    private baseSpeed = 6;
    private baseDamage = 10;
    private baseRange = 1.5;

    public maxHp = 100;
    public hp = 100;
    public isDead = false;

    private readonly initialPosition = new THREE.Vector3(0, 1, 4);
    private damageInvulnerabilityTimer = 0;

    private lastStation: StationId | null = null;
    
    // Variáveis do motor de Dash
    private isDashing = false;
    private dashTimer = 0;
    private dashCooldown = 0;
    private dashDirection = new THREE.Vector3();
    private dashHitTargets = new Set<CombatTarget>();
    private forroDashEnergyGranted = false;
    private forroDashImpactActionId: number | null = null;
    private forroDashImpactTargets: ImpactTargetResult[] = [];
    private forroDashImpactOrigin = new THREE.Vector3();
    private forroDashImpactDirection = new THREE.Vector3();
    private forroDashImpactContext: ImpactContext = { station: 'forro', transformed: false };

    // Variáveis do motor de Pulo
    private velocityY = 0;
    private gravity = 30; // Peso da queda
    private jumpForce = 12; // Força do pulo
    private jumpCount = 0;
    private lastSpaceState = false; 

    private attackState: 'idle' | 'windup' | 'recovery' = 'idle';
    private attackStateTimer = 0;
    private timeSinceLastHit = 999;

    private phonkCombo = 0;
    private globalCombo = 0;
    private phonkMaxTriggered = false; 
    private sambaDodgeTimer = 0;
    private sambaCounterTimer = 0;
    private committedAimSource: 'direct' | 'assisted' | 'none' = 'none';
    private committedAimTargetId: string | null = null;
    private committedAttackCount = 0;
    private readonly impact: ImpactEventDependencies;
    private readonly impactReaction = new LocalImpactReaction();
    private logicalColor = 0x0055ff;
    private logicalEmissiveColor = 0x000000;
    private logicalEmissiveIntensity = 0;

    constructor(
        hud: UIManager,
        onEnergyHit: (successfulHitCount: number) => void,
        onSambaDodge: () => void = () => undefined,
        impactDependencies: Partial<ImpactEventDependencies> = {}
    ) {
        this.hud = hud;
        this.onEnergyHit = onEnergyHit;
        this.onSambaDodge = onSambaDodge;
        this.impact = createLocalImpactDependencies(impactDependencies);
        this.hud.updatePlayerHP(this.hp, this.maxHp);

        const geometry = new THREE.CapsuleGeometry(0.5, 1, 4, 16);
        const material = new THREE.MeshStandardMaterial({ color: 0x0055ff }); 
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.initialPosition);
    }

    public setEmissiveColor(colorHex: number) {
        this.logicalColor = colorHex;
        this.logicalEmissiveColor = colorHex;
        this.logicalEmissiveIntensity = 1;
        this.applyLogicalAppearance();
    }

    public setNeutralColor() {
        this.logicalColor = 0x0055ff;
        this.logicalEmissiveColor = 0x000000;
        this.logicalEmissiveIntensity = 0;
        this.applyLogicalAppearance();
    }

    public get isDamageInvulnerable(): boolean {
        return this.damageInvulnerabilityTimer > 0;
    }

    public get activeStation(): StationId | null {
        return this.lastStation;
    }

    public get isCurrentlyDashing(): boolean {
        return this.isDashing;
    }

    public get currentAttackState(): 'idle' | 'windup' | 'recovery' {
        return this.attackState;
    }

    public get isAirborne(): boolean {
        return this.mesh.position.y > 1 || this.velocityY !== 0;
    }

    public get isSambaDodgeActive(): boolean {
        return this.sambaDodgeTimer > 0;
    }

    public get sambaCounterReady(): boolean {
        return this.sambaCounterTimer > 0;
    }

    public get sambaCounterRemaining(): number {
        return this.sambaCounterTimer;
    }

    public get comboCount(): number {
        return this.globalCombo;
    }

    public get lastCommittedAimSource(): 'direct' | 'assisted' | 'none' {
        return this.committedAimSource;
    }

    public get lastCommittedAimTargetId(): string | null {
        return this.committedAimTargetId;
    }

    public get attackCommitCount(): number {
        return this.committedAttackCount;
    }

    public get currentJumpCount(): number {
        return this.jumpCount;
    }

    public get jumpInputReady(): boolean {
        return !this.lastSpaceState;
    }

    public get forroDashEnergyWasGranted(): boolean {
        return this.forroDashEnergyGranted;
    }

    public get forroDashHitCount(): number {
        return this.dashHitTargets.size;
    }

    public get impactReactionSnapshot(): ImpactReactionSnapshot {
        return this.impactReaction.snapshot;
    }

    public applyImpactReaction(event: ImpactEvent, target: ImpactTargetResult) {
        if (
            event.kind !== 'player-damaged'
            || target.damageAccepted <= 0
            || target.targetId !== 'player'
        ) {
            return;
        }
        this.impactReaction.trigger(event, false);
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
        this.applyLogicalAppearance();
        return displacement;
    }

    public resetImpactReaction() {
        this.impactReaction.reset();
        this.applyLogicalAppearance();
    }

    public openSambaDodgeWindow() {
        if (this.isDead || this.lastStation !== StationId.SAMBA) return;
        this.sambaDodgeTimer = 0.2;
    }

    public openSambaDashWindows() {
        if (this.isDead || this.lastStation !== StationId.SAMBA) return;
        this.sambaDodgeTimer = 0.2;
        this.sambaCounterTimer = 1;
    }

    public resolveCommittedAttack(station: StationId, targets: CombatTarget[]): boolean {
        if (this.isDead) return false;
        this.committedAttackCount++;
        this.executeHitbox(station, targets, this.impact.nextActionId());
        return true;
    }

    public receiveAttack(damage: number): PlayerAttackDecision {
        const result = resolvePlayerAttack(
            this.hp,
            damage,
            this.maxHp,
            {
                dead: this.isDead,
                globallyInvulnerable: this.isDamageInvulnerable,
                sambaDodgeActive: this.isSambaDodgeActive && this.lastStation === StationId.SAMBA
            }
        );

        if (result.dodgedBySamba) {
            this.sambaDodgeTimer = 0;
            this.sambaCounterTimer = 1;
            this.onSambaDodge();
            return result;
        }
        if (result.damageApplied === 0) return result;

        this.hp = result.hp;
        this.damageInvulnerabilityTimer = DAMAGE_INVULNERABILITY_SECONDS;
        this.hud.updatePlayerHP(this.hp, this.maxHp);

        if (result.killed) {
            this.isDead = true;
            this.stopLocalActions();
            this.clearSambaState();
        }

        return result;
    }

    public updateCombatState(deltaSeconds: number) {
        this.damageInvulnerabilityTimer = updateInvulnerabilityTimer(
            this.damageInvulnerabilityTimer,
            deltaSeconds
        );
    }

    public prepareForDeathLifecycle() {
        this.resetImpactReaction();
        this.stopLocalActions();
        this.clearSambaState();
        this.phonkCombo = 0;
        this.globalCombo = 0;
        this.phonkMaxTriggered = false;
        this.timeSinceLastHit = 999;
        this.hud.updateCombo(0);
    }

    public resetAfterDeath() {
        this.prepareForDeathLifecycle();
        this.hp = this.maxHp;
        this.isDead = false;
        this.damageInvulnerabilityTimer = 0;
        this.mesh.position.copy(this.initialPosition);
        this.hud.updatePlayerHP(this.hp, this.maxHp);
    }

    public update(
        delta: number, 
        input: InputManager, 
        camera: THREE.Camera, 
        targets: CombatTarget[],
        currentStation: StationId | null, 
        aimAssistTargets: readonly CombatTarget[] = []
    ) {
        this.updateCombatState(delta);
        if (this.isDead || !currentStation) return;

        if (this.lastStation !== currentStation) {
            this.phonkCombo = 0;
            this.globalCombo = 0;
            this.phonkMaxTriggered = false;
            this.hud.updateCombo(0);
            this.clearSambaState();
            
            if (currentStation === StationId.PHONK) this.hud.setStation('PHONK', '#39FF14');
            if (currentStation === StationId.SAMBA) this.hud.setStation('SAMBA', '#FFD700');
            if (currentStation === StationId.FORRO) this.hud.setStation('FORRÓ', '#FF7F27');

            this.lastStation = currentStation;
        }

        if (this.dashCooldown > 0) this.dashCooldown -= delta;
        this.sambaDodgeTimer = updateCombatWindow(this.sambaDodgeTimer, delta);
        this.sambaCounterTimer = updateCombatWindow(this.sambaCounterTimer, delta);
        this.timeSinceLastHit += delta;

        if (this.timeSinceLastHit > 2.0 && this.globalCombo > 0) {
            this.globalCombo = 0;
            this.phonkCombo = 0;
            this.phonkMaxTriggered = false;
            this.hud.updateCombo(0);
        }

        this.handlePhysicsAndJump(delta, input);
        this.handleDash(delta, input, camera, currentStation, targets);
        this.updateAttackState(delta, input, camera, currentStation, targets, aimAssistTargets);
        
        const wantsToAttack = input.isPressed('MouseLeft');
        if (!this.isDashing && wantsToAttack) {
            this.tryAttack(currentStation, input, camera, targets); 
        }

        this.handleMovement(delta, input, camera, currentStation);
    }

    private handlePhysicsAndJump(delta: number, input: InputManager) {
        if (!this.isDashing) {
            this.velocityY -= this.gravity * delta;
            this.mesh.position.y += this.velocityY * delta;
        } else {
            this.velocityY = 0;
        }

        if (this.mesh.position.y <= 1.0) {
            this.mesh.position.y = 1.0;
            this.velocityY = 0;
            this.jumpCount = 0; 
        }

        const currentSpaceState = input.isPressed('Space');
        
        if (currentSpaceState && !this.lastSpaceState) {
            if (this.jumpCount < 2) {
                this.velocityY = this.jumpForce;
                this.jumpCount++;
            }
        }
        
        this.lastSpaceState = currentSpaceState;
    }

    private getMouseAim(input: InputManager, camera: THREE.Camera, targets: readonly CombatTarget[]) {
        const fallback = new THREE.Vector3(Math.sin(this.mesh.rotation.y), 0, Math.cos(this.mesh.rotation.y));
        if (!input.mousePosition) {
            return { direction: fallback, directDirection: null as THREE.Vector3 | null };
        }

        const raycaster = new THREE.Raycaster();
        const mousePos = new THREE.Vector2(input.mousePosition.x, input.mousePosition.y);
        raycaster.setFromCamera(mousePos, camera);

        const targetMeshes = targets.filter(t => t.state === 'active').map(t => t.mesh);
        const intersects = raycaster.intersectObjects(targetMeshes, false);

        if (intersects.length > 0) {
            const hitMesh = intersects[0].object;
            const dir = hitMesh.position.clone().sub(this.mesh.position);
            dir.y = 0; 
            if (dir.lengthSq() > 0) {
                dir.normalize();
                return { direction: dir, directDirection: dir.clone() };
            }
        }

        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const targetPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, targetPoint);

        if (targetPoint) {
            const dir = targetPoint.sub(this.mesh.position);
            dir.y = 0;
            if (dir.lengthSq() > 0) return { direction: dir.normalize(), directDirection: null as THREE.Vector3 | null };
        }

        return { direction: fallback, directDirection: null as THREE.Vector3 | null };
    }

    private getCommittedAttackDirection(
        input: InputManager,
        camera: THREE.Camera,
        targets: readonly CombatTarget[],
        aimAssistTargets: readonly CombatTarget[]
    ): THREE.Vector3 {
        const aim = this.getMouseAim(input, camera, targets);
        const selection = resolveAttackAim(
            aim.directDirection ? { x: aim.directDirection.x, z: aim.directDirection.z } : null,
            { x: this.mesh.position.x, z: this.mesh.position.z },
            { x: aim.direction.x, z: aim.direction.z },
            aimAssistTargets.map(target => ({
                id: target.id,
                x: target.mesh.position.x,
                z: target.mesh.position.z,
                active: target.state === 'active'
            }))
        );
        this.committedAimSource = aim.directDirection
            ? 'direct'
            : selection.assisted ? 'assisted' : 'none';
        this.committedAimTargetId = selection.candidateId;
        return new THREE.Vector3(selection.direction.x, 0, selection.direction.z).normalize();
    }

    private handleDash(delta: number, input: InputManager, camera: THREE.Camera, station: StationId, targets: CombatTarget[]) {
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
                this.finishForroDashImpact();
                this.isDashing = false;
            }
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
                this.dashHitTargets.clear();
                this.forroDashEnergyGranted = false;
                
                this.dashDirection.copy(this.getMovementDirection(input, camera));
                if (this.dashDirection.lengthSq() === 0) {
                    this.dashDirection.set(Math.sin(this.mesh.rotation.y), 0, Math.cos(this.mesh.rotation.y)).normalize();
                }

                this.attackState = 'idle';

                if (station === StationId.SAMBA) {
                    this.openSambaDashWindows();
                } else if (station === StationId.FORRO) {
                    this.forroDashImpactActionId = this.impact.nextActionId();
                    this.forroDashImpactTargets = [];
                    this.forroDashImpactOrigin.copy(this.mesh.position);
                    this.forroDashImpactDirection.copy(this.dashDirection);
                    this.forroDashImpactContext = this.impact.getContext();
                }
            }
        }
    }

    private updateAttackState(
        delta: number,
        input: InputManager,
        camera: THREE.Camera,
        station: StationId,
        targets: CombatTarget[],
        aimAssistTargets: readonly CombatTarget[]
    ) {
        if (this.attackState === 'idle') return;
        this.attackStateTimer -= delta;

        if (this.attackState === 'windup') {
            if (station === StationId.FORRO) {
                const mouseDir = this.getMouseAim(input, camera, targets).direction;
                const targetRotation = Math.atan2(mouseDir.x, mouseDir.z);
                const currentRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.mesh.rotation.y, 0));
                const targetQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, targetRotation, 0));
                currentRot.slerp(targetQuat, 10 * delta); 
                this.mesh.rotation.y = new THREE.Euler().setFromQuaternion(currentRot).y;
            }

            if (this.attackStateTimer <= 0) {
                const exactMouseDir = this.getCommittedAttackDirection(input, camera, targets, aimAssistTargets);
                this.mesh.rotation.y = Math.atan2(exactMouseDir.x, exactMouseDir.z);
                this.resolveCommittedAttack(station, targets);
                this.attackState = 'recovery';
                this.attackStateTimer = station === StationId.FORRO ? 0.6 : 0.3; 
            }
        } else if (this.attackState === 'recovery') {
            if (this.attackStateTimer <= 0) this.attackState = 'idle';
        }
    }

    private tryAttack(station: StationId, input: InputManager, camera: THREE.Camera, targets: CombatTarget[]) {
        const snapToMouse = () => {
            const mouseDir = this.getMouseAim(input, camera, targets).direction;
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

    private startAttack() {
        this.attackState = 'windup';
        this.attackStateTimer = 0.1; 
    }

    private executeHitbox(station: StationId, targets: CombatTarget[], actionId: number) {
        let range = this.baseRange;
        let damage = this.baseDamage;

        if (station === StationId.FORRO) range *= 1.6;

        const playerForward = new THREE.Vector3(Math.sin(this.mesh.rotation.y), 0, Math.cos(this.mesh.rotation.y)).normalize();
        const attackOrigin = this.mesh.position.clone();
        
        // Mantemos a localização estrita para o uso de outras funções como o hitCenter de ordenação
        const hitCenter = attackOrigin.clone().add(playerForward.clone().multiplyScalar(range));

        const hits = targets.filter(t => {
            if (t.state !== 'active') return false;
            
            if (station === StationId.FORRO) {
                // ATUALIZADO: Uso da matemática extraída pura para a checagem em área
                return forroSweepHit(
                    { x: t.mesh.position.x, z: t.mesh.position.z },
                    { x: attackOrigin.x, z: attackOrigin.z },
                    { x: playerForward.x, z: playerForward.z },
                    range,
                    1.5
                );
            }
            
            const distToCenter = Math.hypot(t.mesh.position.x - hitCenter.x, t.mesh.position.z - hitCenter.z);
            return distToCenter <= 1.5;
        });

        const impactTargets: ImpactTargetResult[] = [];
        const phonkComboBeforeAction = this.phonkCombo;
        let sambaCounterConsumed = false;

        if (hits.length > 0) {
            if (station !== StationId.FORRO) {
                hits.sort((a, b) => 
                    Math.hypot(a.mesh.position.x - hitCenter.x, a.mesh.position.z - hitCenter.z) - 
                    Math.hypot(b.mesh.position.x - hitCenter.x, b.mesh.position.z - hitCenter.z)
                );
                hits.length = 1;
            }

            if (station === StationId.FORRO && hits.length >= 2) {
                this.hud.showPopup("ATAQUE EM ÁREA!", "#FF7F27");
            }

            let appliedHitCount = 0;
            hits.forEach(t => {
                let finalDamage = damage;
                
                if (station === StationId.PHONK) {
                    const damageMultiplier = phonkDamageMultiplier(this.phonkCombo);
                    finalDamage *= damageMultiplier;
                }
                
                if (station === StationId.SAMBA) {
                    finalDamage = sambaDamage(finalDamage, this.sambaCounterReady);
                }

                const impactPosition = this.toImpactVector(t.mesh.position);
                const result = t.receiveHit(playerForward, finalDamage);
                if (!result.applied) return;
                appliedHitCount++;
                impactTargets.push({
                    targetId: t.id,
                    position: impactPosition,
                    damageAccepted: result.damageAccepted,
                    killed: result.killed
                });
                const sambaCounter = decideSambaCounterHit(damage, this.sambaCounterReady, result.applied);
                if (station === StationId.SAMBA && sambaCounter.consumeCounter) {
                    sambaCounterConsumed = true;
                    this.sambaCounterTimer = 0;
                    this.hud.showPopup("CONTRA-ATAQUE!", "#FFD700");
                }
            });

            if (appliedHitCount > 0) {
                this.globalCombo += appliedHitCount;
                this.hud.updateCombo(this.globalCombo);
                this.onEnergyHit(appliedHitCount);

                this.timeSinceLastHit = 0;

                if (station === StationId.PHONK) {
                    this.phonkCombo++;
                    if (this.phonkCombo >= 6 && !this.phonkMaxTriggered) {
                        this.hud.showPopup("DANO MÁXIMO!", "#39FF14");
                        this.phonkMaxTriggered = true;
                    }
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

        const kind = classifyOffensiveImpact({
            source: 'basic-attack',
            station: this.toImpactStation(station),
            targets: impactTargets,
            phonkReachedDamageCap: phonkImpactReachesDamageCap(
                phonkComboBeforeAction,
                impactTargets.length
            ),
            sambaCounterConsumed
        });
        if (!kind) return;
        const context = this.impact.getContext();
        this.impact.emit(createImpactEvent({
            actionId,
            kind,
            source: 'basic-attack',
            station: this.toImpactStation(station),
            transformed: context.transformed,
            origin: this.toImpactVector(attackOrigin),
            direction: this.toImpactVector(playerForward),
            targets: impactTargets
        }));
    }

    private executeDashDamage(targets: CombatTarget[]) {
        const playerForward = new THREE.Vector3(Math.sin(this.mesh.rotation.y), 0, Math.cos(this.mesh.rotation.y)).normalize();
        targets.forEach(target => {
            const dist = Math.hypot(target.mesh.position.x - this.mesh.position.x, target.mesh.position.z - this.mesh.position.z);
            if (target.state === 'active' && dist <= 1.0) {
                if (!this.dashHitTargets.has(target)) {
                    const impactPosition = this.toImpactVector(target.mesh.position);
                    const result = target.receiveHit(playerForward, this.baseDamage * 0.5);
                    this.dashHitTargets.add(target);
                    if (result.applied) {
                        this.forroDashImpactTargets.push({
                            targetId: target.id,
                            position: impactPosition,
                            damageAccepted: result.damageAccepted,
                            killed: result.killed
                        });
                    }
                    const energyDecision = decideForroDashEnergy(
                        this.forroDashEnergyGranted,
                        result.applied,
                        false
                    );
                    this.forroDashEnergyGranted = energyDecision.grantedForDash;
                    if (energyDecision.grantEnergy) this.onEnergyHit(1);
                }
            }
        });
    }

    private finishForroDashImpact() {
        if (this.forroDashImpactActionId === null) return;
        const kind = classifyOffensiveImpact({
            source: 'forro-dash',
            station: 'forro',
            targets: this.forroDashImpactTargets
        });
        if (kind) {
            this.impact.emit(createImpactEvent({
                actionId: this.forroDashImpactActionId,
                kind,
                source: 'forro-dash',
                station: 'forro',
                transformed: this.forroDashImpactContext.transformed,
                origin: this.toImpactVector(this.forroDashImpactOrigin),
                direction: this.toImpactVector(this.forroDashImpactDirection),
                targets: this.forroDashImpactTargets
            }));
        }
        this.forroDashImpactActionId = null;
        this.forroDashImpactTargets = [];
    }

    private handleMovement(delta: number, input: InputManager, camera: THREE.Camera, station: StationId) {
        if (this.isDashing) return;

        let currentSpeed = this.baseSpeed;
        if (station === StationId.PHONK) currentSpeed = 8.5;
        if (station === StationId.FORRO) currentSpeed = 4.5;

        const moveDir = this.getMovementDirection(input, camera);

        if (moveDir.lengthSq() > 0) {
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

    private stopLocalActions() {
        this.isDashing = false;
        this.dashTimer = 0;
        this.dashCooldown = 0;
        this.dashHitTargets.clear();
        this.forroDashEnergyGranted = false;
        this.forroDashImpactActionId = null;
        this.forroDashImpactTargets = [];
        this.velocityY = 0;
        this.jumpCount = 0;
        this.lastSpaceState = false;
        this.attackState = 'idle';
        this.attackStateTimer = 0;
        this.sambaDodgeTimer = 0;
    }

    private clearSambaState() {
        this.sambaDodgeTimer = 0;
        this.sambaCounterTimer = 0;
    }

    private toImpactStation(station: StationId): Exclude<ImpactStation, null> {
        if (station === StationId.PHONK) return 'phonk';
        if (station === StationId.SAMBA) return 'samba';
        return 'forro';
    }

    private toImpactVector(vector: { x: number; y: number; z: number }) {
        return { x: vector.x, y: vector.y, z: vector.z };
    }

    private applyLogicalAppearance() {
        const material = this.mesh.material as THREE.MeshStandardMaterial;
        const reaction = this.impactReactionSnapshot;
        if (reaction.flashActive) {
            material.color.setHex(0xffdddd);
            material.emissive.setHex(0xff4444);
            material.emissiveIntensity = reaction.flashIntensity;
            return;
        }
        material.color.setHex(this.logicalColor);
        material.emissive.setHex(this.logicalEmissiveColor);
        material.emissiveIntensity = this.logicalEmissiveIntensity;
    }

}
