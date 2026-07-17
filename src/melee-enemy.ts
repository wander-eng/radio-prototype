import * as THREE from 'three';
import type { CombatHitResult, CombatTarget, CombatTargetState } from './combat-target';
import { applyDamageToHp } from './combat-math';
import {
    advanceMeleeState,
    clampArenaPosition,
    horizontalDistance,
    MELEE_DYING_SECONDS,
    meleeAttackHits,
    meleeRespawnSnapshot,
    separatePositionXZ,
    windupProgress,
    type MeleeState
} from './melee-math';
import type { Player } from './player';
import type { MeleeAttackToken } from './melee-attack-token';

export const MELEE_SPEED = 3.2;
export const MELEE_ATTACK_RANGE = 1.5;
export const MELEE_ATTACK_DAMAGE = 20;
export const MELEE_VERTICAL_TOLERANCE = 1.25;
const BODY_SEPARATION_DISTANCE = 1;

export class MeleeEnemy implements CombatTarget {
    public readonly id: string;
    public readonly mesh: THREE.Mesh;
    public hp = 50;
    public readonly maxHp = 50;
    public state: CombatTargetState = 'active';
    public meleeState: MeleeState = 'chase';
    public attackResolutionCount = 0;

    private readonly spawnPosition: THREE.Vector3;
    private readonly material: THREE.MeshStandardMaterial;
    private readonly telegraphRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
    private readonly baseColor = new THREE.Color(0x8b1a1a);
    private readonly telegraphColor = new THREE.Color(0xffff00);
    private stateTimer = 0;
    private flashTimer = 0;
    private readonly hpBarContainer: HTMLDivElement;
    private readonly hpBarFill: HTMLDivElement;
    private readonly attackToken: MeleeAttackToken;
    private readonly coordinationDirection: -1 | 1;

    constructor(
        id: string,
        spawnPosition: THREE.Vector3,
        attackToken: MeleeAttackToken,
        coordinationDirection: -1 | 1
    ) {
        this.id = id;
        this.spawnPosition = spawnPosition.clone();
        this.attackToken = attackToken;
        this.coordinationDirection = coordinationDirection;

        this.material = new THREE.MeshStandardMaterial({ color: this.baseColor });
        this.mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), this.material);
        this.mesh.position.copy(this.spawnPosition);

        this.telegraphRing = new THREE.Mesh(
            new THREE.RingGeometry(0.7, 0.9, 32),
            new THREE.MeshBasicMaterial({
                color: this.telegraphColor,
                transparent: true,
                opacity: 0.8,
                side: THREE.DoubleSide,
                depthWrite: false
            })
        );
        this.telegraphRing.rotation.x = -Math.PI / 2;
        this.telegraphRing.position.y = -0.99;
        this.telegraphRing.visible = false;
        this.mesh.add(this.telegraphRing);

        this.hpBarContainer = document.createElement('div');
        this.hpBarContainer.className = 'target-hp-container';
        this.hpBarFill = document.createElement('div');
        this.hpBarFill.className = 'target-hp-fill';
        this.hpBarContainer.appendChild(this.hpBarFill);
        document.body.appendChild(this.hpBarContainer);
        this.updateHpBar();
    }

    public get telegraphActive(): boolean {
        return this.meleeState === 'windup';
    }

    public get telegraphProgress(): number {
        return this.telegraphActive ? windupProgress(this.stateTimer) : 0;
    }

    public receiveHit(direction: THREE.Vector3, damage: number = 10): CombatHitResult {
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
            this.attackToken.release(this.id);
            this.state = 'dying';
            this.meleeState = 'dying';
            this.stateTimer = MELEE_DYING_SECONDS;
            this.hpBarContainer.style.display = 'none';
            this.resetTelegraph();
            return { applied: true, killed: true, damageAccepted: result.damageApplied };
        }

        this.flashTimer = 0.1;
        const knockback = direction.clone();
        knockback.y = 0;
        if (knockback.lengthSq() > 0) {
            knockback.normalize().multiplyScalar(0.8);
            this.mesh.position.add(knockback);
            this.clampToArena();
        }

        return { applied: true, killed: false, damageAccepted: result.damageApplied };
    }

    public update(deltaSeconds: number, player: Player, camera: THREE.Camera) {
        const delta = Math.max(0, deltaSeconds);

        if (this.meleeState === 'dying' || this.meleeState === 'dead') {
            this.updateLifecycle(delta);
            return;
        }

        if (this.meleeState === 'chase') this.updateChase(delta, player);
        else if (this.meleeState === 'windup') this.updateWindup(delta);
        else if (this.meleeState === 'attack') this.resolveAttack(player);
        else if (this.meleeState === 'recovery') this.updateRecovery(delta);

        if (!player.isCurrentlyDashing) this.separateFromPlayer(player.mesh.position);
        this.clampToArena();
        this.updatePresentation(delta, camera);
    }

    public resolvePendingAttack(player: Player): boolean {
        if (this.meleeState !== 'windup' || this.state !== 'active') return false;
        this.enterState('attack', 0);
        this.resolveAttack(player);
        return true;
    }

    public reset() {
        this.attackToken.release(this.id);
        const snapshot = meleeRespawnSnapshot(this.maxHp, this.spawnPosition);
        this.hp = snapshot.hp;
        this.state = 'active';
        this.meleeState = snapshot.state;
        this.stateTimer = 0;
        this.flashTimer = 0;
        this.attackResolutionCount = 0;
        this.mesh.visible = true;
        this.mesh.scale.set(1, 1, 1);
        this.mesh.position.set(snapshot.position.x, snapshot.position.y, snapshot.position.z);
        this.resetTelegraph();
        this.updateHpBar();
    }

    private updateChase(delta: number, player: Player) {
        const playerPosition = player.mesh.position;
        const distance = horizontalDistance(this.mesh.position, playerPosition);
        if (distance <= MELEE_ATTACK_RANGE) {
            if (this.tryStartWindup()) return;
            this.repositionWhileWaiting(delta, playerPosition);
            return;
        }

        const direction = new THREE.Vector3(
            playerPosition.x - this.mesh.position.x,
            0,
            playerPosition.z - this.mesh.position.z
        );
        if (direction.lengthSq() === 0) return;

        direction.normalize();
        const maxTravel = Math.max(0, distance - MELEE_ATTACK_RANGE);
        this.mesh.position.addScaledVector(direction, Math.min(MELEE_SPEED * delta, maxTravel));
        const desiredAngle = Math.atan2(direction.x, direction.z);
        this.mesh.rotation.y = THREE.MathUtils.damp(this.mesh.rotation.y, desiredAngle, 10, delta);

        if (horizontalDistance(this.mesh.position, playerPosition) <= MELEE_ATTACK_RANGE) {
            this.tryStartWindup();
        }
    }

    private updateWindup(delta: number) {
        const transition = advanceMeleeState('windup', this.stateTimer, delta, true);
        this.enterState(transition.state, transition.timer);
    }

    private resolveAttack(player: Player) {
        const transition = advanceMeleeState('attack', 0, 0, true);
        if (transition.resolveAttack) {
            this.attackResolutionCount++;
            if (meleeAttackHits(
                this.mesh.position,
                player.mesh.position,
                MELEE_ATTACK_RANGE,
                MELEE_VERTICAL_TOLERANCE
            )) {
                player.receiveAttack(MELEE_ATTACK_DAMAGE);
            }
        }
        this.enterState(transition.state, transition.timer);
        this.attackToken.release(this.id);
    }

    private updateRecovery(delta: number) {
        const transition = advanceMeleeState('recovery', this.stateTimer, delta, false);
        this.enterState(transition.state, transition.timer);
    }

    private updateLifecycle(delta: number) {
        const previousState = this.meleeState;
        const transition = advanceMeleeState(previousState, this.stateTimer, delta, false);
        this.enterState(transition.state, transition.timer);

        if (previousState === 'dying') {
            const scale = transition.state === 'dying'
                ? Math.max(0, transition.timer / MELEE_DYING_SECONDS)
                : 0;
            this.mesh.scale.setScalar(scale);
        }

        if (transition.state === 'dead') {
            this.state = 'dead';
            this.mesh.visible = false;
        }

        if (transition.respawn) this.reset();
    }

    private enterState(state: MeleeState, timer: number) {
        const stateChanged = state !== this.meleeState;
        this.meleeState = state;
        this.stateTimer = timer;
        if (stateChanged && state !== 'windup') this.resetTelegraph();
    }

    private tryStartWindup(): boolean {
        if (!this.attackToken.tryAcquire(this.id)) return false;
        const transition = advanceMeleeState('chase', 0, 0, true);
        this.enterState(transition.state, transition.timer);
        return true;
    }

    private repositionWhileWaiting(delta: number, playerPosition: THREE.Vector3) {
        const radial = new THREE.Vector3(
            this.mesh.position.x - playerPosition.x,
            0,
            this.mesh.position.z - playerPosition.z
        );
        if (radial.lengthSq() === 0) radial.set(this.coordinationDirection, 0, 0);
        radial.normalize();
        const tangent = new THREE.Vector3(
            -radial.z * this.coordinationDirection,
            0,
            radial.x * this.coordinationDirection
        );
        tangent.addScaledVector(radial, 0.35).normalize();
        this.mesh.position.addScaledVector(tangent, MELEE_SPEED * 0.5 * delta);
        this.mesh.rotation.y = Math.atan2(tangent.x, tangent.z);
    }

    private separateFromPlayer(playerPosition: THREE.Vector3) {
        const separated = separatePositionXZ(this.mesh.position, playerPosition, BODY_SEPARATION_DISTANCE);
        this.mesh.position.x = separated.x;
        this.mesh.position.z = separated.z;
    }

    private clampToArena() {
        const clamped = clampArenaPosition(this.mesh.position);
        this.mesh.position.x = clamped.x;
        this.mesh.position.z = clamped.z;
    }

    private updatePresentation(delta: number, camera: THREE.Camera) {
        if (this.flashTimer > 0) this.flashTimer = Math.max(0, this.flashTimer - delta);

        if (this.telegraphActive) {
            const progress = this.telegraphProgress;
            this.material.color.copy(this.baseColor).lerp(this.telegraphColor, progress);
            this.material.emissive.copy(this.telegraphColor).multiplyScalar(progress * 0.35);
            this.telegraphRing.visible = true;
            this.telegraphRing.scale.setScalar(1 - progress * 0.65);
        } else if (this.flashTimer > 0) {
            this.material.color.setHex(0xffffff);
            this.material.emissive.setHex(0x555555);
        } else {
            this.material.color.copy(this.baseColor);
            this.material.emissive.setHex(0x000000);
        }

        this.updateHpBarScreenPosition(camera);
    }

    private resetTelegraph() {
        this.telegraphRing.visible = false;
        this.telegraphRing.scale.setScalar(1);
        this.material.color.copy(this.baseColor);
        this.material.emissive.setHex(0x000000);
    }

    private updateHpBarScreenPosition(camera: THREE.Camera) {
        const screenPosition = this.mesh.position.clone();
        screenPosition.y += 1.5;
        screenPosition.project(camera);

        if (screenPosition.z > 1 || this.state !== 'active') {
            this.hpBarContainer.style.display = 'none';
            return;
        }

        const x = (screenPosition.x * 0.5 + 0.5) * window.innerWidth;
        const y = -(screenPosition.y * 0.5 - 0.5) * window.innerHeight;
        this.hpBarContainer.style.display = 'block';
        this.hpBarContainer.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
    }

    private updateHpBar() {
        this.hpBarFill.style.width = `${Math.max(0, (this.hp / this.maxHp) * 100)}%`;
    }
}
