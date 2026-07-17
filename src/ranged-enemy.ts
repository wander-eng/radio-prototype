import * as THREE from 'three';
import type { CombatHitResult, CombatTarget, CombatTargetState } from './combat-target';
import { applyDamageToHp } from './combat-math';
import { clampArenaPosition, horizontalDistance } from './melee-math';
import type { Player } from './player';
import {
    advanceRangedState,
    rangedDistanceAction,
    RANGED_MAX_DISTANCE,
    RANGED_MIN_DISTANCE,
    RANGED_DYING_SECONDS,
    rangedRespawnSnapshot,
    rangedWindupProgress,
    type RangedState
} from './ranged-math';

export const RANGED_SPEED = 2.5;

export class RangedEnemy implements CombatTarget {
    public readonly id: string;
    public readonly mesh: THREE.Mesh;
    public hp = 40;
    public readonly maxHp = 40;
    public state: CombatTargetState = 'active';
    public rangedState: RangedState = 'reposition';
    public shotCount = 0;

    private readonly spawnPosition: THREE.Vector3;
    private readonly material: THREE.MeshStandardMaterial;
    private readonly telegraphRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
    private readonly chargeSphere: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
    private readonly baseColor = new THREE.Color(0x6633aa);
    private readonly telegraphColor = new THREE.Color(0xffff00);
    private stateTimer = 0;
    private flashTimer = 0;
    private readonly hpBarContainer: HTMLDivElement;
    private readonly hpBarFill: HTMLDivElement;
    private readonly fireProjectile: (origin: THREE.Vector3, target: THREE.Vector3) => void;

    constructor(
        id: string,
        spawnPosition: THREE.Vector3,
        fireProjectile: (origin: THREE.Vector3, target: THREE.Vector3) => void
    ) {
        this.id = id;
        this.spawnPosition = spawnPosition.clone();
        this.fireProjectile = fireProjectile;
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
        this.mesh.add(this.telegraphRing);

        this.chargeSphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.35, 12, 8),
            new THREE.MeshStandardMaterial({
                color: 0xffff55,
                emissive: 0xffff00,
                emissiveIntensity: 1.5,
                transparent: true,
                opacity: 0.9
            })
        );
        this.chargeSphere.position.set(0, 0.5, 0.7);
        this.mesh.add(this.chargeSphere);
        this.resetTelegraph();

        this.hpBarContainer = document.createElement('div');
        this.hpBarContainer.className = 'target-hp-container';
        this.hpBarFill = document.createElement('div');
        this.hpBarFill.className = 'target-hp-fill';
        this.hpBarContainer.appendChild(this.hpBarFill);
        document.body.appendChild(this.hpBarContainer);
        this.updateHpBar();
    }

    public get telegraphActive(): boolean {
        return this.rangedState === 'windup';
    }

    public get telegraphProgress(): number {
        return this.telegraphActive ? rangedWindupProgress(this.stateTimer) : 0;
    }

    public receiveHit(direction: THREE.Vector3, damage: number = 10): CombatHitResult {
        if (this.state !== 'active') return { applied: false, killed: false, damageAccepted: 0 };
        const result = applyDamageToHp(this.hp, damage, this.maxHp);
        if (result.damageApplied === 0) return { applied: false, killed: false, damageAccepted: 0 };

        this.hp = result.hp;
        this.updateHpBar();
        if (result.killed) {
            this.state = 'dying';
            this.rangedState = 'dying';
            this.stateTimer = RANGED_DYING_SECONDS;
            this.hpBarContainer.style.display = 'none';
            this.resetTelegraph();
            return { applied: true, killed: true, damageAccepted: result.damageApplied };
        }

        this.flashTimer = 0.1;
        const knockback = direction.clone();
        knockback.y = 0;
        if (knockback.lengthSq() > 0) this.mesh.position.add(knockback.normalize().multiplyScalar(0.8));
        this.clampToArena();
        return { applied: true, killed: false, damageAccepted: result.damageApplied };
    }

    public update(deltaSeconds: number, player: Player, camera: THREE.Camera) {
        const delta = Math.max(0, deltaSeconds);
        if (this.rangedState === 'dying' || this.rangedState === 'dead') {
            this.updateLifecycle(delta);
            return;
        }

        if (this.rangedState === 'reposition') this.updateReposition(delta, player);
        else if (this.rangedState === 'windup') this.updateWindup(delta, player);
        else if (this.rangedState === 'attack') this.resolveShot(player);
        else if (this.rangedState === 'recovery') this.updateRecovery(delta);

        this.clampToArena();
        this.updatePresentation(delta, camera);
    }

    public reset() {
        const snapshot = rangedRespawnSnapshot(this.maxHp, this.spawnPosition);
        this.hp = snapshot.hp;
        this.state = 'active';
        this.rangedState = snapshot.state;
        this.stateTimer = 0;
        this.flashTimer = 0;
        this.shotCount = 0;
        this.mesh.visible = true;
        this.mesh.scale.set(1, 1, 1);
        this.mesh.position.set(snapshot.position.x, snapshot.position.y, snapshot.position.z);
        this.resetTelegraph();
        this.updateHpBar();
    }

    private updateReposition(delta: number, player: Player) {
        const distance = horizontalDistance(this.mesh.position, player.mesh.position);
        const action = rangedDistanceAction(distance);
        if (action === 'hold') {
            const transition = advanceRangedState('reposition', 0, delta, true);
            this.enterState(transition.state, transition.timer);
            return;
        }

        const direction = new THREE.Vector3(
            player.mesh.position.x - this.mesh.position.x,
            0,
            player.mesh.position.z - this.mesh.position.z
        );
        if (direction.lengthSq() === 0) return;
        direction.normalize();
        if (action === 'retreat') direction.negate();
        const distanceToPreferredBand = action === 'approach'
            ? distance - RANGED_MAX_DISTANCE
            : RANGED_MIN_DISTANCE - distance;
        this.mesh.position.addScaledVector(
            direction,
            Math.min(RANGED_SPEED * delta, Math.max(0, distanceToPreferredBand))
        );
        this.mesh.rotation.y = THREE.MathUtils.damp(
            this.mesh.rotation.y,
            Math.atan2(direction.x, direction.z),
            8,
            delta
        );
    }

    private updateWindup(delta: number, player: Player) {
        const look = player.mesh.position.clone().sub(this.mesh.position);
        look.y = 0;
        if (look.lengthSq() > 0) this.mesh.rotation.y = Math.atan2(look.x, look.z);
        const transition = advanceRangedState('windup', this.stateTimer, delta, true);
        this.enterState(transition.state, transition.timer);
    }

    private resolveShot(player: Player) {
        const transition = advanceRangedState('attack', 0, 0, true);
        if (transition.fireProjectile) {
            this.shotCount++;
            const origin = this.mesh.position.clone().add(new THREE.Vector3(0, 0.5, 0));
            this.fireProjectile(origin, player.mesh.position.clone());
        }
        this.enterState(transition.state, transition.timer);
    }

    private updateRecovery(delta: number) {
        const transition = advanceRangedState('recovery', this.stateTimer, delta, false);
        this.enterState(transition.state, transition.timer);
    }

    private updateLifecycle(delta: number) {
        const previous = this.rangedState;
        const transition = advanceRangedState(previous, this.stateTimer, delta, false);
        this.enterState(transition.state, transition.timer);
        if (previous === 'dying') {
            const scale = transition.state === 'dying'
                ? Math.max(0, transition.timer / RANGED_DYING_SECONDS)
                : 0;
            this.mesh.scale.setScalar(scale);
        }
        if (transition.state === 'dead') {
            this.state = 'dead';
            this.mesh.visible = false;
        }
        if (transition.respawn) this.reset();
    }

    private enterState(state: RangedState, timer: number) {
        const changed = state !== this.rangedState;
        this.rangedState = state;
        this.stateTimer = timer;
        if (changed && state !== 'windup') this.resetTelegraph();
    }

    private updatePresentation(delta: number, camera: THREE.Camera) {
        if (this.flashTimer > 0) this.flashTimer = Math.max(0, this.flashTimer - delta);
        if (this.telegraphActive) {
            const progress = this.telegraphProgress;
            this.material.color.copy(this.baseColor).lerp(this.telegraphColor, progress);
            this.material.emissive.copy(this.telegraphColor).multiplyScalar(progress * 0.35);
            this.telegraphRing.visible = true;
            this.telegraphRing.scale.setScalar(1 - progress * 0.65);
            this.chargeSphere.visible = true;
            this.chargeSphere.scale.setScalar(0.25 + progress * 0.75);
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
        this.chargeSphere.visible = false;
        this.chargeSphere.scale.setScalar(0.25);
        this.material?.color.copy(this.baseColor);
        this.material?.emissive.setHex(0x000000);
    }

    private clampToArena() {
        const clamped = clampArenaPosition(this.mesh.position);
        this.mesh.position.x = clamped.x;
        this.mesh.position.z = clamped.z;
    }

    private updateHpBarScreenPosition(camera: THREE.Camera) {
        const screen = this.mesh.position.clone();
        screen.y += 1.5;
        screen.project(camera);
        if (screen.z > 1 || this.state !== 'active') {
            this.hpBarContainer.style.display = 'none';
            return;
        }
        const x = (screen.x * 0.5 + 0.5) * window.innerWidth;
        const y = -(screen.y * 0.5 - 0.5) * window.innerHeight;
        this.hpBarContainer.style.display = 'block';
        this.hpBarContainer.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
    }

    private updateHpBar() {
        this.hpBarFill.style.width = `${Math.max(0, (this.hp / this.maxHp) * 100)}%`;
    }
}
