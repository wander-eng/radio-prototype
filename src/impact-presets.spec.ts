import { describe, expect, it } from 'vitest';
import type { ImpactKind, ImpactStation } from './impact-event';
import {
    selectImpactPreset,
    TRANSFORMED_IMPACT_PRESENCE
} from './impact-presets';

function preset(
    station: ImpactStation,
    kind: ImpactKind = 'normal',
    transformed: boolean = false
) {
    return selectImpactPreset({ station, kind, transformed });
}

describe('impact station presets', () => {
    it('selects one deterministic preset per station and a safe fallback', () => {
        expect(preset('phonk').name).toBe('phonk');
        expect(preset('samba').name).toBe('samba');
        expect(preset('forro').name).toBe('forro');
        expect(preset(null).name).toBe('fallback');
        expect(preset('phonk')).toEqual(preset('phonk'));
    });

    it('uses the validated station colors and distinct spark shapes', () => {
        expect(preset('phonk').spark).toMatchObject({
            color: 0x39ff14,
            shape: 'radial'
        });
        expect(preset('samba').spark).toMatchObject({
            color: 0xffd700,
            shape: 'narrow'
        });
        expect(preset('forro').spark).toMatchObject({
            color: 0xff7f27,
            shape: 'fan'
        });
    });

    it('keeps damage received distinct and Samba confirmation golden', () => {
        expect(preset('phonk', 'player-damaged').spark.color).toBe(0xff3030);
        expect(preset('samba', 'samba-dodge').spark.color).toBe(0xffd700);
    });

    it('selects distinct sound envelopes without separate pipelines', () => {
        const phonk = preset('phonk').sound;
        const samba = preset('samba').sound;
        const forro = preset('forro').sound;
        expect(phonk.pitchMultiplier).toBeLessThan(samba.pitchMultiplier);
        expect(phonk.durationMultiplier).toBeLessThan(forro.durationMultiplier);
        expect(samba.attackSeconds).toBeLessThan(phonk.attackSeconds);
    });

    it('keeps strong categories above normal through the shared category hierarchy', () => {
        expect(preset('phonk', 'phonk-strong').kind).toBe('phonk-strong');
        expect(preset('samba', 'samba-counter').kind).toBe('samba-counter');
        expect(preset('forro', 'forro-multi').kind).toBe('forro-multi');
        expect(preset('phonk', 'enemy-kill').kind).toBe('enemy-kill');
    });

    it('uses transformation only as a bounded presence modifier', () => {
        const transformed = preset('forro', 'forro-multi', true);
        expect(transformed.name).toBe('forro');
        expect(transformed.kind).toBe('forro-multi');
        expect(transformed.presence).toBe(TRANSFORMED_IMPACT_PRESENCE);
        expect(transformed.id).toBe('forro:forro-multi:transformed');
    });
});
