import * as THREE from 'three';
import type { CombatTarget } from './combat-target';
import { EnemyProjectile } from './enemy-projectile';
import { MeleeAttackToken } from './melee-attack-token';
import { MeleeEnemy } from './melee-enemy';
import { clampArenaPosition, horizontalDistance, separatePositionXZ } from './melee-math';
import type { Player } from './player';
import { RangedEnemy } from './ranged-enemy';
import { captureProjectileDirection } from './ranged-math';

export interface EnemySnapshot {
    id: string;
    archetype: 'melee' | 'ranged';
    state: string;
    hp: number;
    x: number;
    y: number;
    z: number;
    telegraphActive: boolean;
    telegraphProgress: number;
    attackResolutionCount?: number;
    shotCount?: number;
}

export interface ProjectileSnapshot {
    id: string;
    x: number;
    y: number;
    z: number;
    direction: { x: number; y: number; z: number };
    remainingLife: number;
}

export interface EncounterSnapshot {
    enemies: EnemySnapshot[];
    projectiles: ProjectileSnapshot[];
    meleeAttackOwnerId: string | null;
}

export class EncounterController {
    public readonly melees: readonly MeleeEnemy[];
    public readonly ranged: RangedEnemy;
    private readonly meleeToken = new MeleeAttackToken();
    private readonly activeProjectiles: EnemyProjectile[] = [];
    private readonly scene: THREE.Scene;
    private readonly player: Player;
    private projectileSequence = 0;

    constructor(
        scene: THREE.Scene,
        player: Player
    ) {
        this.scene = scene;
        this.player = player;
        this.melees = [
            new MeleeEnemy('melee_0', new THREE.Vector3(-3, 1, -3), this.meleeToken, -1),
            new MeleeEnemy('melee_1', new THREE.Vector3(3, 1, -3), this.meleeToken, 1)
        ];
        this.ranged = new RangedEnemy(
            'ranged_0',
            new THREE.Vector3(0, 1, -8),
            (origin, target) => this.spawnProjectile(origin, target)
        );

        for (const enemy of this.combatTargets) this.scene.add(enemy.mesh);
    }

    public get combatTargets(): CombatTarget[] {
        return [...this.melees, this.ranged];
    }

    public update(deltaSeconds: number, camera: THREE.Camera) {
        if (this.player.isDead) return;
        for (const melee of this.melees) {
            melee.update(deltaSeconds, this.player, camera);
            if (this.player.isDead) return;
        }
        this.separateMelees();
        this.ranged.update(deltaSeconds, this.player, camera);
        if (this.player.isDead) return;
        this.updateProjectiles(deltaSeconds);
    }

    public reset() {
        this.clearProjectiles();
        this.meleeToken.clear();
        for (const melee of this.melees) melee.reset();
        this.ranged.reset();
        this.projectileSequence = 0;
    }

    public clearProjectiles() {
        for (const projectile of this.activeProjectiles) this.disposeProjectile(projectile);
        this.activeProjectiles.length = 0;
    }

    public spawnProjectile(origin: THREE.Vector3, target: THREE.Vector3) {
        const direction = captureProjectileDirection(origin, target);
        const projectile = new EnemyProjectile(
            `projectile_${this.projectileSequence++}`,
            origin,
            new THREE.Vector3(direction.x, direction.y, direction.z)
        );
        this.activeProjectiles.push(projectile);
        this.scene.add(projectile.mesh);
    }

    public setEnemyPosition(id: string, x: number, y: number, z: number) {
        const enemy = this.combatTargets.find(candidate => candidate.id === id);
        if (!enemy) return;
        const clamped = clampArenaPosition({ x, z });
        enemy.mesh.position.set(clamped.x, y, clamped.z);
    }

    public resolvePendingMeleeAttack(id: string): boolean {
        const melee = this.melees.find(candidate => candidate.id === id);
        return melee?.resolvePendingAttack(this.player) ?? false;
    }

    public snapshot(): EncounterSnapshot {
        const enemies: EnemySnapshot[] = [
            ...this.melees.map((melee) => ({
                id: melee.id,
                archetype: 'melee' as const,
                state: melee.meleeState,
                hp: melee.hp,
                x: melee.mesh.position.x,
                y: melee.mesh.position.y,
                z: melee.mesh.position.z,
                telegraphActive: melee.telegraphActive,
                telegraphProgress: melee.telegraphProgress,
                attackResolutionCount: melee.attackResolutionCount
            })),
            {
                id: this.ranged.id,
                archetype: 'ranged',
                state: this.ranged.rangedState,
                hp: this.ranged.hp,
                x: this.ranged.mesh.position.x,
                y: this.ranged.mesh.position.y,
                z: this.ranged.mesh.position.z,
                telegraphActive: this.ranged.telegraphActive,
                telegraphProgress: this.ranged.telegraphProgress,
                shotCount: this.ranged.shotCount
            }
        ];

        return {
            enemies,
            projectiles: this.activeProjectiles.map((projectile) => ({
                id: projectile.id,
                x: projectile.mesh.position.x,
                y: projectile.mesh.position.y,
                z: projectile.mesh.position.z,
                direction: {
                    x: projectile.direction.x,
                    y: projectile.direction.y,
                    z: projectile.direction.z
                },
                remainingLife: projectile.remainingLife
            })),
            meleeAttackOwnerId: this.meleeToken.ownerId
        };
    }

    private updateProjectiles(deltaSeconds: number) {
        for (let index = this.activeProjectiles.length - 1; index >= 0; index--) {
            const projectile = this.activeProjectiles[index];
            const shouldRemove = projectile.update(deltaSeconds) || projectile.tryHit(this.player);
            if (!shouldRemove) continue;
            this.disposeProjectile(projectile);
            this.activeProjectiles.splice(index, 1);
        }
    }

    private disposeProjectile(projectile: EnemyProjectile) {
        this.scene.remove(projectile.mesh);
        projectile.mesh.geometry.dispose();
        (projectile.mesh.material as THREE.Material).dispose();
    }

    private separateMelees() {
        const [first, second] = this.melees;
        if (first.state !== 'active' || second.state !== 'active') return;
        if (horizontalDistance(first.mesh.position, second.mesh.position) >= 1) return;

        const fixed = this.meleeToken.ownerId === first.id ? first : second;
        const movable = fixed === first ? second : first;
        const separated = separatePositionXZ(movable.mesh.position, fixed.mesh.position, 1);
        const clamped = clampArenaPosition(separated);
        movable.mesh.position.x = clamped.x;
        movable.mesh.position.z = clamped.z;
    }
}
