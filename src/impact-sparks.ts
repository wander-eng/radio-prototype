import * as THREE from 'three';
import type { ImpactEvent, ImpactVector3 } from './impact-event';
import {
    burstAdmission,
    sparkRequestsForImpact,
    type BurstLimitEntry,
    type SparkBurstRequest
} from './impact-feedback';

interface ActiveSparkBurst extends BurstLimitEntry {
    readonly actionId: number;
    readonly points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
    readonly velocities: Float32Array;
    readonly lifetimeSeconds: number;
    elapsedSeconds: number;
}

export interface ImpactSparkSnapshot {
    readonly burstCount: number;
    readonly particleCount: number;
}

function deterministicUnit(seed: number): number {
    const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return value - Math.floor(value);
}

function shapedVelocity(
    request: SparkBurstRequest,
    mainDirection: ImpactVector3,
    seed: number,
    speed: number
): ImpactVector3 {
    const horizontalLength = Math.hypot(mainDirection.x, mainDirection.z);
    const forwardX = horizontalLength > Number.EPSILON
        ? mainDirection.x / horizontalLength
        : 0;
    const forwardZ = horizontalLength > Number.EPSILON
        ? mainDirection.z / horizontalLength
        : -1;
    const randomA = deterministicUnit(seed);
    const randomB = deterministicUnit(seed + 1);
    const randomY = deterministicUnit(seed + 2);

    if (request.shape === 'narrow') {
        const side = (randomA - 0.5) * request.spread * 0.45;
        return {
            x: (forwardX * request.forwardWeight - forwardZ * side) * speed,
            y: (request.verticalBias + (randomY - 0.5) * 0.18) * speed,
            z: (forwardZ * request.forwardWeight + forwardX * side) * speed
        };
    }

    if (request.shape === 'fan') {
        const angle = (randomA - 0.5) * request.spread;
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        const arcX = forwardX * cosine - forwardZ * sine;
        const arcZ = forwardX * sine + forwardZ * cosine;
        return {
            x: arcX * request.forwardWeight * speed,
            y: (request.verticalBias + (randomY - 0.5) * 0.28) * speed,
            z: arcZ * request.forwardWeight * speed
        };
    }

    const angle = randomA * Math.PI * 2;
    const radialStrength = request.spread * (0.55 + randomB * 0.45);
    return {
        x: (
            Math.cos(angle) * radialStrength
            + forwardX * request.forwardWeight
        ) * speed,
        y: (
            request.verticalBias
            + (randomY - 0.45) * request.spread
        ) * speed,
        z: (
            Math.sin(angle) * radialStrength
            + forwardZ * request.forwardWeight
        ) * speed
    };
}

function normalizedDirection(direction: ImpactVector3): ImpactVector3 {
    const length = Math.hypot(direction.x, direction.y, direction.z);
    if (length <= Number.EPSILON) return { x: 0, y: 0.35, z: -1 };
    return {
        x: direction.x / length,
        y: direction.y / length,
        z: direction.z / length
    };
}

export class ImpactSparkController {
    private readonly scene: THREE.Scene;
    private bursts: ActiveSparkBurst[] = [];
    private nextBurstId = 0;
    private createdOrder = 0;
    private lastActionId: number | null = null;
    private paused = false;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    public request(event: ImpactEvent): number {
        if (event.actionId === this.lastActionId) return 0;
        this.lastActionId = event.actionId;

        let created = 0;
        for (const request of sparkRequestsForImpact(event)) {
            const candidate: BurstLimitEntry = {
                id: this.nextBurstId + 1,
                kind: request.kind,
                particleCount: request.particleCount,
                createdOrder: this.createdOrder + 1
            };
            const admission = burstAdmission(this.bursts, candidate);
            if (!admission.accepted) continue;
            admission.evictedIds.forEach(id => this.removeBurstById(id));
            this.bursts.push(this.createBurst(request));
            created++;
        }
        return created;
    }

    public setPaused(paused: boolean) {
        this.paused = paused;
    }

    public update(presentationDeltaSeconds: number) {
        if (this.paused) return;
        const delta = Math.max(0, presentationDeltaSeconds);
        for (let index = this.bursts.length - 1; index >= 0; index--) {
            const burst = this.bursts[index];
            burst.elapsedSeconds += delta;
            const positions = burst.points.geometry.getAttribute('position') as THREE.BufferAttribute;
            const values = positions.array as Float32Array;
            for (let particle = 0; particle < burst.particleCount; particle++) {
                const offset = particle * 3;
                values[offset] += burst.velocities[offset] * delta;
                values[offset + 1] += burst.velocities[offset + 1] * delta;
                values[offset + 2] += burst.velocities[offset + 2] * delta;
            }
            positions.needsUpdate = true;
            const progress = Math.min(
                1,
                burst.elapsedSeconds / burst.lifetimeSeconds
            );
            burst.points.material.opacity = Math.max(0, 1 - progress * progress);
            if (burst.elapsedSeconds >= burst.lifetimeSeconds) {
                this.removeBurstAt(index);
            }
        }
    }

    public reset() {
        for (let index = this.bursts.length - 1; index >= 0; index--) {
            this.removeBurstAt(index);
        }
        this.lastActionId = null;
        this.paused = false;
    }

    public get snapshot(): ImpactSparkSnapshot {
        return Object.freeze({
            burstCount: this.bursts.length,
            particleCount: this.bursts.reduce(
                (sum, burst) => sum + burst.particleCount,
                0
            )
        });
    }

    private createBurst(request: SparkBurstRequest): ActiveSparkBurst {
        const id = ++this.nextBurstId;
        const createdOrder = ++this.createdOrder;
        const positions = new Float32Array(request.particleCount * 3);
        const velocities = new Float32Array(request.particleCount * 3);
        const mainDirection = normalizedDirection(request.direction);

        for (let particle = 0; particle < request.particleCount; particle++) {
            const offset = particle * 3;
            const seed = request.actionId * 97 + particle * 13 + id;
            positions[offset] = request.position.x
                + (deterministicUnit(seed + 4) - 0.5) * 0.12;
            positions[offset + 1] = request.position.y
                + (deterministicUnit(seed + 5) - 0.5) * 0.12;
            positions[offset + 2] = request.position.z
                + (deterministicUnit(seed + 6) - 0.5) * 0.12;
            const speed = request.speedMin
                + deterministicUnit(seed + 3) * (request.speedMax - request.speedMin);
            const velocity = shapedVelocity(request, mainDirection, seed, speed);
            velocities[offset] = velocity.x;
            velocities[offset + 1] = velocity.y;
            velocities[offset + 2] = velocity.z;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({
            color: request.color,
            size: request.pointSize,
            transparent: true,
            opacity: 1,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false
        });
        const points = new THREE.Points(geometry, material);
        this.scene.add(points);

        return {
            id,
            actionId: request.actionId,
            kind: request.kind,
            particleCount: request.particleCount,
            createdOrder,
            points,
            velocities,
            lifetimeSeconds: request.lifetimeSeconds,
            elapsedSeconds: 0
        };
    }

    private removeBurstById(id: number) {
        const index = this.bursts.findIndex(burst => burst.id === id);
        if (index >= 0) this.removeBurstAt(index);
    }

    private removeBurstAt(index: number) {
        const [burst] = this.bursts.splice(index, 1);
        if (!burst) return;
        this.scene.remove(burst.points);
        burst.points.geometry.dispose();
        burst.points.material.dispose();
    }
}
