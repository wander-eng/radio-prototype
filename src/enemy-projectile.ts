import * as THREE from 'three';
import type { Player } from './player';
import {
    advanceProjectile,
    PROJECTILE_DAMAGE,
    PROJECTILE_MAX_LIFE_SECONDS,
    PROJECTILE_RADIUS,
    projectileOutsideArena,
    spheresIntersect3D
} from './ranged-math';

const PLAYER_COLLISION_RADIUS = 0.5;

export class EnemyProjectile {
    public readonly id: string;
    public readonly mesh: THREE.Mesh;
    public readonly direction: THREE.Vector3;
    public remainingLife = PROJECTILE_MAX_LIFE_SECONDS;
    public consumed = false;

    constructor(
        id: string,
        origin: THREE.Vector3,
        direction: THREE.Vector3
    ) {
        this.id = id;
        this.direction = direction.clone().normalize();
        this.mesh = new THREE.Mesh(
            new THREE.SphereGeometry(PROJECTILE_RADIUS, 12, 8),
            new THREE.MeshStandardMaterial({
                color: 0x55ccff,
                emissive: 0x2288ff,
                emissiveIntensity: 1.5
            })
        );
        this.mesh.position.copy(origin);
    }

    public update(deltaSeconds: number): boolean {
        const result = advanceProjectile({
            position: this.mesh.position,
            direction: this.direction,
            remainingLife: this.remainingLife
        }, deltaSeconds);
        this.mesh.position.set(result.position.x, result.position.y, result.position.z);
        this.remainingLife = result.remainingLife;
        return this.remainingLife === 0 || projectileOutsideArena(this.mesh.position);
    }

    public tryHit(player: Player): boolean {
        if (player.isDead || this.consumed) return false;
        const colliding = spheresIntersect3D(
            this.mesh.position,
            PROJECTILE_RADIUS,
            player.mesh.position,
            PLAYER_COLLISION_RADIUS
        );
        if (!colliding) return false;

        const result = player.receiveAttack(PROJECTILE_DAMAGE);
        if (!result.threatConsumed) return false;
        this.consumed = true;
        return true;
    }
}
