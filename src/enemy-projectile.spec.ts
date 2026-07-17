import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { PlayerAttackDecision } from './combat-math';
import { EnemyProjectile } from './enemy-projectile';
import type { Player } from './player';

function createPlayerMock(
    position: THREE.Vector3,
    decision: PlayerAttackDecision
): Player {
    return {
        isDead: false,
        mesh: { position },
        receiveAttack: vi.fn(() => decision)
    } as unknown as Player;
}

const acceptedAttack: PlayerAttackDecision = {
    hp: 85,
    damageApplied: 15,
    killed: false,
    outcome: 'damage-applied',
    ignoredByInvulnerability: false,
    dodgedBySamba: false,
    threatConsumed: true
};

describe('EnemyProjectile impact integration', () => {
    it('delegates the decision to Player and consumes a colliding threat only once', () => {
        const projectile = new EnemyProjectile(
            'projectile_test',
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0, 0, 1)
        );
        const player = createPlayerMock(new THREE.Vector3(0, 1, 0), acceptedAttack);

        expect(projectile.tryHit(player)).toBe(true);
        expect(projectile.consumed).toBe(true);
        expect(player.receiveAttack).toHaveBeenCalledWith(15);
        expect(projectile.tryHit(player)).toBe(false);
        expect(player.receiveAttack).toHaveBeenCalledTimes(1);
    });

    it('does not delegate damage without a 3D collision', () => {
        const projectile = new EnemyProjectile(
            'projectile_miss',
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0, 0, 1)
        );
        const player = createPlayerMock(new THREE.Vector3(0, 3, 0), acceptedAttack);

        expect(projectile.tryHit(player)).toBe(false);
        expect(projectile.consumed).toBe(false);
        expect(player.receiveAttack).not.toHaveBeenCalled();
    });

    it('keeps the projectile active when Player rejects consumption', () => {
        const projectile = new EnemyProjectile(
            'projectile_rejected',
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0, 0, 1)
        );
        const player = createPlayerMock(new THREE.Vector3(0, 1, 0), {
            ...acceptedAttack,
            hp: 100,
            damageApplied: 0,
            outcome: 'ignored-dead',
            threatConsumed: false
        });

        expect(projectile.tryHit(player)).toBe(false);
        expect(projectile.consumed).toBe(false);
    });
});
