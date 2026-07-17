import type * as THREE from 'three';

export type CombatTargetState = 'active' | 'dying' | 'dead';

export interface CombatHitResult {
    applied: boolean;
    killed: boolean;
    damageAccepted: number;
}

export interface CombatTarget {
    readonly id: string;
    readonly mesh: THREE.Object3D;
    hp: number;
    readonly maxHp: number;
    state: CombatTargetState;
    receiveHit(direction: THREE.Vector3, damage: number): CombatHitResult;
}
