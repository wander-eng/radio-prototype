import { describe, expect, it } from 'vitest';
import {
    clampReactionPosition,
    easeOutQuadratic,
    flashDurationForImpact,
    LocalImpactReaction,
    knockbackDistanceForImpact,
    MAX_KNOCKBACK_DISTANCE,
    normalizedDirectionXZ,
    selectFlashKind
} from './impact-reaction';
import type { ImpactKind } from './impact-event';

const event = (
    kind: ImpactKind,
    transformed: boolean = false,
    direction = { x: 3, y: 9, z: 4 },
    station: 'phonk' | 'samba' | 'forro' | null = null
) => ({ kind, transformed, direction, station });

describe('impact flash math', () => {
    it.each([
        ['miss', 0],
        ['normal', 0.08],
        ['phonk-strong', 0.1],
        ['samba-counter', 0.1],
        ['forro-multi', 0.09],
        ['enemy-kill', 0.12],
        ['player-damaged', 0.12],
        ['samba-dodge', 0.08]
    ] as const)('maps %s to %s seconds', (kind, duration) => {
        expect(flashDurationForImpact(kind)).toBe(duration);
    });

    it('lets a superior category replace an inferior one', () => {
        expect(selectFlashKind('normal', 'enemy-kill')).toBe('enemy-kill');
        expect(selectFlashKind('enemy-kill', 'normal')).toBe('enemy-kill');
        expect(selectFlashKind('normal', 'phonk-strong')).toBe('phonk-strong');
    });

    it('renews flash duration without accumulating intensity', () => {
        const reaction = new LocalImpactReaction();
        reaction.trigger(event('normal'), false);
        reaction.update(0.05, 0);
        reaction.trigger(event('normal'), false);

        expect(reaction.snapshot.flashRemaining).toBe(0.08);
        expect(reaction.snapshot.flashIntensity).toBe(0.55);
    });

    it('applies station flash signatures without accumulating brightness', () => {
        const phonk = new LocalImpactReaction();
        const samba = new LocalImpactReaction();
        phonk.trigger(event('normal', false, undefined, 'phonk'), false);
        samba.trigger(event('normal', false, undefined, 'samba'), false);
        expect(phonk.snapshot.flashIntensity)
            .toBeGreaterThan(samba.snapshot.flashIntensity);
        expect(phonk.snapshot.flashRemaining)
            .toBeGreaterThan(samba.snapshot.flashRemaining);
    });
});

describe('knockback math', () => {
    it('normalizes direction only in XZ', () => {
        expect(normalizedDirectionXZ({ x: 3, y: 8, z: 4 })).toEqual({
            x: 0.6,
            y: 0,
            z: 0.8
        });
        expect(normalizedDirectionXZ({ x: 0, y: 5, z: 0 })).toEqual({
            x: 0,
            y: 0,
            z: 0
        });
    });

    it('uses ease-out and clamps its progress', () => {
        expect(easeOutQuadratic(0)).toBe(0);
        expect(easeOutQuadratic(0.5)).toBe(0.75);
        expect(easeOutQuadratic(1)).toBe(1);
        expect(easeOutQuadratic(2)).toBe(1);
    });

    it('applies transformed tuning before category limits', () => {
        expect(knockbackDistanceForImpact('normal', false)).toBe(0.65);
        expect(knockbackDistanceForImpact('normal', true)).toBeCloseTo(0.78);
        expect(knockbackDistanceForImpact('phonk-strong', true)).toBe(1.02);
        expect(knockbackDistanceForImpact('enemy-kill', true)).toBe(0.6);
        expect(knockbackDistanceForImpact('player-damaged', true)).toBe(0);
    });

    it('applies station knockback signatures within existing limits', () => {
        const phonk = knockbackDistanceForImpact('normal', false, 'phonk');
        const samba = knockbackDistanceForImpact('normal', false, 'samba');
        expect(phonk).toBeGreaterThan(samba);
        expect(phonk).toBeLessThanOrEqual(MAX_KNOCKBACK_DISTANCE);
    });

    it('clamps positions to the arena without changing height', () => {
        expect(clampReactionPosition({ x: 13, y: 2, z: -14 })).toEqual({
            x: 12,
            y: 2,
            z: -12
        });
    });

    it('progresses over gameplay time and freezes with zero delta', () => {
        const reaction = new LocalImpactReaction();
        reaction.trigger(event('normal', false, { x: 1, y: 0, z: 0 }), true);
        const frozen = reaction.update(0.03, 0);
        expect(frozen).toEqual({ x: 0, y: 0, z: 0 });
        expect(reaction.snapshot.knockbackRemainingDistance).toBe(0.65);

        const firstHalf = reaction.update(0, 0.04);
        expect(firstHalf.x).toBeCloseTo(0.4875);
        expect(reaction.snapshot.knockbackActive).toBe(true);
        const secondHalf = reaction.update(0, 0.04);
        expect(firstHalf.x + secondHalf.x).toBeCloseTo(0.65);
        expect(reaction.snapshot.knockbackActive).toBe(false);
    });

    it('combines repeated impulses without growing beyond the global ceiling', () => {
        const reaction = new LocalImpactReaction();
        for (let hit = 0; hit < 10; hit++) {
            reaction.trigger(event('normal', false, { x: 1, y: 0, z: 0 }), true);
        }
        expect(reaction.snapshot.knockbackRemainingDistance)
            .toBe(MAX_KNOCKBACK_DISTANCE);
    });

    it('keeps lethal reaction within its own limit', () => {
        const reaction = new LocalImpactReaction();
        reaction.trigger(event('normal'), true);
        reaction.trigger(event('enemy-kill'), true);
        expect(reaction.snapshot.knockbackRemainingDistance).toBe(0.6);
    });

    it('resets flash and knockback idempotently', () => {
        const reaction = new LocalImpactReaction();
        reaction.trigger(event('phonk-strong'), true);
        reaction.reset();
        const first = reaction.snapshot;
        reaction.reset();
        expect(reaction.snapshot).toEqual(first);
        expect(first).toMatchObject({
            flashActive: false,
            knockbackActive: false
        });
    });
});
