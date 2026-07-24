import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
    createImpactEvent,
    type ImpactKind,
    type ImpactStation
} from './impact-event';
import { ImpactSparkController } from './impact-sparks';

function event(
    kind: ImpactKind = 'normal',
    actionId: number = 1,
    station: ImpactStation = 'phonk',
    transformed: boolean = false
) {
    return createImpactEvent({
        actionId,
        kind,
        source: 'basic-attack',
        station,
        transformed,
        origin: { x: 0, y: 1, z: 0 },
        direction: { x: 1, y: 0, z: 0 },
        targets: kind === 'miss' ? [] : [{
            targetId: 'target',
            position: { x: 1, y: 1, z: 0 },
            damageAccepted: 10,
            killed: kind === 'enemy-kill'
        }]
    });
}

describe('ImpactSparkController', () => {
    it('adiciona um Points por burst e descarta recursos ao expirar', () => {
        const scene = new THREE.Scene();
        const controller = new ImpactSparkController(scene);
        const geometryDispose = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
        const materialDispose = vi.spyOn(THREE.Material.prototype, 'dispose');

        expect(controller.request(event())).toBe(1);
        expect(controller.snapshot).toEqual({ burstCount: 1, particleCount: 6 });
        expect(scene.children.some(child => child instanceof THREE.Points)).toBe(true);

        controller.update(0.23);

        expect(controller.snapshot).toEqual({ burstCount: 0, particleCount: 0 });
        expect(scene.children.some(child => child instanceof THREE.Points)).toBe(false);
        expect(geometryDispose).toHaveBeenCalled();
        expect(materialDispose).toHaveBeenCalled();
        geometryDispose.mockRestore();
        materialDispose.mockRestore();
    });

    it('pausa congela vida e movimento, enquanto atualização normal continua no hitstop', () => {
        const scene = new THREE.Scene();
        const controller = new ImpactSparkController(scene);
        controller.request(event());
        const points = scene.children.find(child => child instanceof THREE.Points) as THREE.Points;
        const positions = points.geometry.getAttribute('position').array as Float32Array;
        const initialX = positions[0];

        controller.setPaused(true);
        controller.update(1);
        expect(controller.snapshot.burstCount).toBe(1);
        expect(positions[0]).toBe(initialX);

        controller.setPaused(false);
        controller.update(0.01);
        expect(positions[0]).not.toBe(initialX);
    });

    it('deduplica solicitação global da mesma ação e reset é idempotente', () => {
        const scene = new THREE.Scene();
        const controller = new ImpactSparkController(scene);
        expect(controller.request(event('normal', 7))).toBe(1);
        expect(controller.request(event('normal', 7))).toBe(0);

        controller.reset();
        controller.reset();
        expect(controller.snapshot).toEqual({ burstCount: 0, particleCount: 0 });
        expect(scene.children).toHaveLength(0);
    });

    it('miss produz apenas áudio e nenhum spark', () => {
        const controller = new ImpactSparkController(new THREE.Scene());
        expect(controller.request(event('miss'))).toBe(0);
        expect(controller.snapshot).toEqual({ burstCount: 0, particleCount: 0 });
    });

    it.each([
        ['phonk', 0x39ff14],
        ['samba', 0xffd700],
        ['forro', 0xff7f27]
    ] as const)('uses the %s preset in the shared spark controller', (station, color) => {
        const scene = new THREE.Scene();
        const controller = new ImpactSparkController(scene);
        controller.request(event('normal', 20, station));
        const points = scene.children.find(
            child => child instanceof THREE.Points
        ) as THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
        expect(points.material.color.getHex()).toBe(color);
        controller.reset();
    });

    it('applies transformed presence without creating another pipeline', () => {
        const scene = new THREE.Scene();
        const controller = new ImpactSparkController(scene);
        controller.request(event('normal', 21, 'forro', true));
        expect(controller.snapshot).toEqual({ burstCount: 1, particleCount: 8 });
        expect(scene.children.filter(child => child instanceof THREE.Points))
            .toHaveLength(1);
    });
});
