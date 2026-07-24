import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FollowCamera } from './camera';
import { CameraShakeController } from './camera-shake';
import { EffectsManager } from './effects';
import { createImpactEvent, type ImpactKind } from './impact-event';
import { StationId } from './radio';

function event(kind: ImpactKind, actionId: number = 1) {
    return createImpactEvent({
        actionId,
        kind,
        source: kind === 'player-damaged' ? 'melee' : 'basic-attack',
        station: kind === 'player-damaged' ? null : 'phonk',
        transformed: false,
        origin: { x: 0, y: 1, z: 0 },
        direction: { x: 1, y: 0, z: 0 },
        targets: [{
            targetId: kind === 'player-damaged' ? 'player' : 'target',
            position: { x: 1, y: 1, z: 0 },
            damageAccepted: 10,
            killed: kind === 'enemy-kill'
        }]
    });
}

describe('camera shake presentation integration', () => {
    beforeEach(() => {
        vi.stubGlobal('window', { innerWidth: 1280, innerHeight: 720 });
    });

    it('applies shake after the base position and never feeds it into the next frame', () => {
        const follow = new FollowCamera();
        const shake = new CameraShakeController();
        const target = new THREE.Vector3(2, 1, 3);
        const originalBaseOffset = follow.baseOffset.clone();

        follow.update(target, 0.2);
        const baseline = follow.camera.position.clone();
        shake.request(event('normal'));
        const firstOffset = shake.advance(0.01);
        follow.applyPresentationOffset(firstOffset);

        expect(follow.camera.position.toArray()).toEqual([
            baseline.x + firstOffset.x,
            baseline.y + firstOffset.y,
            baseline.z + firstOffset.z
        ]);
        expect(follow.baseOffset.toArray()).toEqual(originalBaseOffset.toArray());

        follow.update(target, 0);
        expect(follow.camera.position.toArray()).toEqual(baseline.toArray());
        const secondOffset = shake.advance(0.01);
        follow.applyPresentationOffset(secondOffset);
        follow.update(target, 0);
        expect(follow.camera.position.toArray()).toEqual(baseline.toArray());

        shake.advance(0.08);
        follow.applyPresentationOffset(shake.advance(0));
        expect(follow.camera.position.toArray()).toEqual(baseline.toArray());
        expect(follow.presentationOffsetSnapshot).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('preserves station offsets and returns to the same baseline after repeated impacts', () => {
        const follow = new FollowCamera();
        const effects = new EffectsManager(new THREE.Scene(), follow);
        const shake = new CameraShakeController();
        const target = new THREE.Vector3(0, 1, 0);

        effects.playStationSwitchEffect(StationId.FORRO, target);
        const stationOffset = follow.positionalOffset.clone();
        const stationAngle = follow.angularOffset;
        follow.update(target, 0.2);
        const stationBaseline = follow.camera.position.clone();

        for (let actionId = 1; actionId <= 5; actionId++) {
            shake.request(event('phonk-strong', actionId));
            follow.applyPresentationOffset(shake.advance(0.02));
            follow.update(target, 0);
        }
        shake.advance(1);
        follow.applyPresentationOffset(shake.advance(0));

        expect(follow.camera.position.toArray()).toEqual(stationBaseline.toArray());
        expect(follow.positionalOffset.toArray()).toEqual(stationOffset.toArray());
        expect(follow.angularOffset).toBe(stationAngle);
        expect(follow.camera.fov).toBe(follow.baseFov);
    });

    it('neutralizes pause and reset without consuming or restoring a stale offset', () => {
        const follow = new FollowCamera();
        const shake = new CameraShakeController();
        const target = new THREE.Vector3(0, 1, 0);
        follow.update(target, 0.2);
        const baseline = follow.camera.position.clone();

        shake.request(event('player-damaged'));
        follow.applyPresentationOffset(shake.advance(0.04));
        expect(follow.camera.position.equals(baseline)).toBe(false);

        shake.setPaused(true);
        follow.clearPresentationOffset();
        expect(follow.camera.position.toArray()).toEqual(baseline.toArray());
        expect(shake.advance(1)).toEqual({ x: 0, y: 0, z: 0 });
        expect(shake.snapshot.active).toBe(true);

        shake.setPaused(false);
        follow.applyPresentationOffset(shake.advance(0.01));
        expect(follow.camera.position.equals(baseline)).toBe(false);
        shake.reset();
        follow.clearPresentationOffset();
        shake.reset();
        follow.clearPresentationOffset();

        expect(follow.camera.position.toArray()).toEqual(baseline.toArray());
        expect(shake.snapshot).toMatchObject({ active: false, intensity: 0 });
    });
});
