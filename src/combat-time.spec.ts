import { describe, expect, it } from 'vitest';
import { drainTransformationEnergy } from './combat-math';
import {
    CombatTimeController,
    hitstopDurationForImpact,
    MAX_HITSTOP_SECONDS
} from './combat-time';
import { createImpactEvent, type ImpactKind } from './impact-event';
import { updateCombatWindow } from './station-combat-math';

function impact(
    kind: ImpactKind,
    transformed: boolean = false,
    playerKilled: boolean = false
) {
    return createImpactEvent({
        actionId: 1,
        kind,
        source: kind === 'player-damaged' ? 'melee' : 'basic-attack',
        station: null,
        transformed,
        origin: { x: 0, y: 1, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        targets: [{
            targetId: kind === 'player-damaged' ? 'player' : 'enemy',
            position: { x: 0, y: 1, z: 1 },
            damageAccepted: 10,
            killed: playerKilled
        }]
    });
}

describe('hitstop duration', () => {
    it.each([
        ['miss', 0],
        ['normal', 0.03],
        ['phonk-strong', 0.045],
        ['samba-counter', 0.05],
        ['forro-multi', 0.045],
        ['enemy-kill', 0.065],
        ['player-damaged', 0.055],
        ['samba-dodge', 0]
    ] as const)('maps %s to %s seconds', (kind, expected) => {
        expect(hitstopDurationForImpact(impact(kind))).toBe(expected);
    });

    it('adds the transformed modifier without exceeding the global cap', () => {
        expect(hitstopDurationForImpact(impact('normal', true))).toBe(0.04);
        expect(hitstopDurationForImpact(impact('enemy-kill', true)))
            .toBe(MAX_HITSTOP_SECONDS);
        expect(hitstopDurationForImpact(impact('miss', true))).toBe(0);
        expect(hitstopDurationForImpact(impact('samba-dodge', true))).toBe(0);
    });

    it('applies the station signature while preserving category hierarchy', () => {
        const normal = impact('normal');
        const phonk = { ...normal, station: 'phonk' as const };
        const samba = { ...normal, station: 'samba' as const };
        const forro = { ...normal, station: 'forro' as const };
        expect(hitstopDurationForImpact(phonk))
            .toBeGreaterThan(hitstopDurationForImpact(forro));
        expect(hitstopDurationForImpact(samba))
            .toBeLessThan(hitstopDurationForImpact(forro));
        expect(hitstopDurationForImpact({
            ...impact('phonk-strong'),
            station: 'phonk'
        })).toBeGreaterThan(hitstopDurationForImpact(phonk));
    });

    it('does not delay lethal damage to the player', () => {
        expect(hitstopDurationForImpact(impact('player-damaged', false, true))).toBe(0);
        expect(hitstopDurationForImpact(impact('player-damaged', true, true))).toBe(0);
    });
});

describe('CombatTimeController', () => {
    it('uses the expected priority for normal, Samba, hitstop, pause and death', () => {
        const time = new CombatTimeController();
        expect(time.snapshot.effectiveTimeScale).toBe(1);

        time.startSambaSlowMotion();
        expect(time.snapshot.effectiveTimeScale).toBe(0.5);

        time.requestHitstop(impact('normal'));
        expect(time.snapshot.effectiveTimeScale).toBe(0);
        expect(time.snapshot.activeTimeSources).toEqual([
            'hitstop',
            'samba-slow-motion'
        ]);

        time.setPaused(true);
        expect(time.snapshot.effectiveTimeScale).toBe(0);
        expect(time.snapshot.activeTimeSources[0]).toBe('paused');

        time.setPaused(false);
        time.setDead(true);
        expect(time.snapshot.effectiveTimeScale).toBe(0);
        expect(time.snapshot.activeTimeSources).toEqual(['death']);
    });

    it('uses unscaled delta for timers and lets Samba continue during hitstop', () => {
        const time = new CombatTimeController();
        time.startSambaSlowMotion();
        time.requestHitstop(impact('samba-counter'));

        const step = time.advance(0.02);
        expect(step.unscaledDeltaSeconds).toBe(0.02);
        expect(step.presentationDeltaSeconds).toBe(0.02);
        expect(step.gameplayDeltaSeconds).toBe(0);
        expect(time.snapshot.hitstopRemaining).toBeCloseTo(0.03);
        expect(time.snapshot.sambaSlowMotionRemaining).toBeCloseTo(0.13);
    });

    it('freezes both timers while paused', () => {
        const time = new CombatTimeController();
        time.startSambaSlowMotion();
        time.requestHitstop(impact('normal'));
        time.setPaused(true);

        time.advance(1);
        expect(time.snapshot.hitstopRemaining).toBe(0.03);
        expect(time.snapshot.sambaSlowMotionRemaining).toBe(0.15);
    });

    it('combines simultaneous hitstops by max instead of sum', () => {
        const time = new CombatTimeController();
        time.requestHitstop(impact('normal'));
        time.requestHitstop(impact('samba-counter'));
        time.requestHitstop(impact('forro-multi'));

        expect(time.snapshot.hitstopRemaining).toBe(0.05);
    });

    it('keeps gameplay windows frozen while presentation and transformation advance', () => {
        const time = new CombatTimeController();
        time.requestHitstop(impact('normal'));
        const step = time.advance(0.02);

        expect(updateCombatWindow(1, step.gameplayDeltaSeconds)).toBe(1);
        expect(drainTransformationEnergy(100, step.unscaledDeltaSeconds))
            .toBeCloseTo(99.8666667);
    });

    it('requests one global Forro hitstop from its aggregated action', () => {
        const time = new CombatTimeController();
        const event = impact('forro-multi');
        expect(time.requestHitstop(event)).toBe(0.045);
        expect(time.snapshot.hitstopRemaining).toBe(0.045);
    });

    it('clears every source on death and restores scale one on reset', () => {
        const time = new CombatTimeController();
        time.startSambaSlowMotion();
        time.requestHitstop(impact('enemy-kill'));
        time.setDead(true);

        expect(time.snapshot).toMatchObject({
            hitstopActive: false,
            hitstopRemaining: 0,
            sambaSlowMotionActive: false,
            sambaSlowMotionRemaining: 0,
            effectiveTimeScale: 0,
            activeTimeSources: ['death']
        });

        time.reset();
        expect(time.snapshot).toMatchObject({
            hitstopActive: false,
            hitstopRemaining: 0,
            sambaSlowMotionActive: false,
            sambaSlowMotionRemaining: 0,
            effectiveTimeScale: 1,
            activeTimeSources: []
        });
    });

    it('has an idempotent reset', () => {
        const time = new CombatTimeController();
        time.requestHitstop(impact('normal'));
        time.reset();
        const first = time.snapshot;
        time.reset();
        expect(time.snapshot).toEqual(first);
    });
});
