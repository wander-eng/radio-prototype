import { describe, expect, it } from 'vitest';
import {
    createImpactEvent,
    type ImpactEvent,
    type ImpactKind,
    type ImpactStation
} from './impact-event';
import {
    MAX_IMPACT_BURSTS,
    MAX_IMPACT_PARTICLES,
    MAX_IMPACT_VOICES,
    burstAdmission,
    deterministicImpactVariant,
    soundProfileForImpact,
    sparkRequestsForImpact,
    voiceAdmission,
    type BurstLimitEntry,
    type VoiceLimitEntry
} from './impact-feedback';

function impact(
    kind: ImpactKind,
    options: {
        transformed?: boolean;
        targetCount?: number;
        actionId?: number;
        station?: ImpactStation;
    } = {}
): ImpactEvent {
    return createImpactEvent({
        actionId: options.actionId ?? 1,
        kind,
        source: kind === 'forro-multi' ? 'forro-dash' : 'basic-attack',
        station: options.station ?? (
            kind === 'forro-multi'
                ? 'forro'
                : kind === 'samba-counter' || kind === 'samba-dodge'
                    ? 'samba'
                    : 'phonk'
        ),
        transformed: options.transformed ?? false,
        origin: { x: 0, y: 1, z: 0 },
        direction: { x: 1, y: 0, z: 0 },
        targets: Array.from({ length: options.targetCount ?? (kind === 'miss' ? 0 : 1) }, (_, index) => ({
            targetId: `target_${index}`,
            position: { x: index + 1, y: 1, z: 0 },
            damageAccepted: 10,
            killed: kind === 'enemy-kill'
        }))
    });
}

describe('impact spark tuning and limits', () => {
    it.each([
        ['miss', 0],
        ['normal', 6],
        ['phonk-strong', 10],
        ['samba-counter', 8],
        ['enemy-kill', 14],
        ['player-damaged', 6],
        ['samba-dodge', 6]
    ] as const)('%s solicita a quantidade esperada', (kind, count) => {
        const requests = sparkRequestsForImpact(impact(kind));
        expect(requests.reduce((sum, request) => sum + request.particleCount, 0)).toBe(count);
    });

    it('transformação multiplica presença sem alterar categoria', () => {
        const [request] = sparkRequestsForImpact(impact('normal', { transformed: true }));
        expect(request.kind).toBe('normal');
        expect(request.particleCount).toBe(8);
    });

    it('Forró distribui até 12 partículas entre alvos da mesma ação', () => {
        const requests = sparkRequestsForImpact(impact('forro-multi', {
            transformed: true,
            targetCount: 3
        }));
        expect(requests).toHaveLength(3);
        expect(new Set(requests.map(request => request.actionId)).size).toBe(1);
        expect(requests.reduce((sum, request) => sum + request.particleCount, 0)).toBe(12);
    });

    it('mantém vidas entre 120ms e 260ms', () => {
        const kinds: ImpactKind[] = [
            'normal', 'phonk-strong', 'samba-counter', 'forro-multi',
            'enemy-kill', 'player-damaged', 'samba-dodge'
        ];
        for (const kind of kinds) {
            const [request] = sparkRequestsForImpact(impact(kind, {
                targetCount: kind === 'forro-multi' ? 2 : 1
            }));
            expect(request.lifetimeSeconds).toBeGreaterThanOrEqual(0.12);
            expect(request.lifetimeSeconds).toBeLessThanOrEqual(0.26);
        }
    });

    it('resolves station color and shape from the shared preset', () => {
        const [phonk] = sparkRequestsForImpact(impact('normal', { station: 'phonk' }));
        const [samba] = sparkRequestsForImpact(impact('normal', { station: 'samba' }));
        const [forro] = sparkRequestsForImpact(impact('normal', { station: 'forro' }));
        expect(phonk).toMatchObject({ color: 0x39ff14, shape: 'radial' });
        expect(samba).toMatchObject({ color: 0xffd700, shape: 'narrow' });
        expect(forro).toMatchObject({ color: 0xff7f27, shape: 'fan' });
    });

    it('descarta hit normal quando os limites já foram alcançados', () => {
        const existing: BurstLimitEntry[] = Array.from(
            { length: MAX_IMPACT_BURSTS },
            (_, index) => ({
                id: index,
                kind: 'normal',
                particleCount: MAX_IMPACT_PARTICLES / MAX_IMPACT_BURSTS,
                createdOrder: index
            })
        );
        expect(burstAdmission(existing, {
            kind: 'normal',
            particleCount: 6
        })).toEqual({ accepted: false, evictedIds: [] });
    });

    it.each(['enemy-kill', 'player-damaged'] as const)(
        '%s remove o normal mais antigo para permanecer dentro dos limites',
        (kind) => {
            const existing: BurstLimitEntry[] = Array.from(
                { length: MAX_IMPACT_BURSTS },
                (_, index) => ({
                    id: index + 1,
                    kind: index < 3 ? 'normal' : 'phonk-strong',
                    particleCount: 8,
                    createdOrder: index
                })
            );
            const result = burstAdmission(existing, {
                kind,
                particleCount: 14
            });
            expect(result.accepted).toBe(true);
            expect(result.evictedIds).toEqual([1, 2]);
        }
    );
});

describe('impact synthetic sound tuning and limits', () => {
    it('seleciona até três variantes deterministicamente', () => {
        expect([0, 1, 2, 3, 4].map(id => deterministicImpactVariant(id))).toEqual([
            0, 1, 2, 0, 1
        ]);
        expect(deterministicImpactVariant(8)).toBe(deterministicImpactVariant(8));
    });

    it('transformação aumenta presença respeitando o limite', () => {
        const base = soundProfileForImpact(impact('player-damaged'));
        const transformed = soundProfileForImpact(impact('player-damaged', {
            transformed: true
        }));
        expect(transformed.kind).toBe(base.kind);
        expect(transformed.gain).toBeGreaterThan(base.gain);
        expect(transformed.gain).toBeLessThanOrEqual(0.44);
    });

    it('mantém vocabulário audível e diferencia os impactos principais', () => {
        const swing = soundProfileForImpact(impact('miss'));
        const normal = soundProfileForImpact(impact('normal'));
        const phonk = soundProfileForImpact(impact('phonk-strong'));
        const counter = soundProfileForImpact(impact('samba-counter'));
        const kill = soundProfileForImpact(impact('enemy-kill'));
        const damaged = soundProfileForImpact(impact('player-damaged'));

        expect(swing.gain).toBeGreaterThan(0);
        expect(normal.gain).toBeGreaterThan(swing.gain);
        expect(phonk.frequencyHz).not.toBe(counter.frequencyHz);
        expect(kill.gain).toBeGreaterThan(phonk.gain);
        expect(damaged.gain).toBeGreaterThan(kill.gain);
    });

    it('resolves distinct station sound profiles from the same vocabulary', () => {
        const phonk = soundProfileForImpact(impact('normal', { station: 'phonk' }));
        const samba = soundProfileForImpact(impact('normal', { station: 'samba' }));
        const forro = soundProfileForImpact(impact('normal', { station: 'forro' }));
        expect(phonk.presetId).toBe('phonk:normal:base');
        expect(samba.presetId).toBe('samba:normal:base');
        expect(forro.presetId).toBe('forro:normal:base');
        expect(phonk.frequencyHz).toBeLessThan(samba.frequencyHz);
        expect(phonk.durationSeconds).toBeLessThan(forro.durationSeconds);
    });

    it('keeps Phonk strong and Samba counter above their station normal hit', () => {
        const phonkNormal = soundProfileForImpact(
            impact('normal', { station: 'phonk' })
        );
        const phonkStrong = soundProfileForImpact(
            impact('phonk-strong', { station: 'phonk' })
        );
        const sambaNormal = soundProfileForImpact(
            impact('normal', { station: 'samba' })
        );
        const sambaCounter = soundProfileForImpact(
            impact('samba-counter', { station: 'samba' })
        );
        expect(phonkStrong.gain).toBeGreaterThan(phonkNormal.gain);
        expect(sambaCounter.gain).toBeGreaterThan(sambaNormal.gain);
        expect(sparkRequestsForImpact(
            impact('phonk-strong', { station: 'phonk' })
        )[0].pointSize).toBeGreaterThan(
            sparkRequestsForImpact(impact('normal', { station: 'phonk' }))[0]
                .pointSize
        );
    });

    it('aceita até oito vozes', () => {
        const existing: VoiceLimitEntry[] = Array.from(
            { length: MAX_IMPACT_VOICES - 1 },
            (_, index) => ({
                id: index,
                kind: 'normal',
                createdOrder: index,
                protected: false
            })
        );
        expect(voiceAdmission(existing, {
            kind: 'normal',
            protected: false
        })).toEqual({ accepted: true, evictedId: null });
    });

    it('substitui a voz normal mais antiga ao atingir o teto', () => {
        const existing: VoiceLimitEntry[] = Array.from(
            { length: MAX_IMPACT_VOICES },
            (_, index) => ({
                id: index + 10,
                kind: index < 2 ? 'normal' : 'strong',
                createdOrder: index,
                protected: false
            })
        );
        expect(voiceAdmission(existing, {
            kind: 'kill',
            protected: true
        })).toEqual({ accepted: true, evictedId: 10 });
    });

    it('swing não substitui morte ou dano recebido', () => {
        const existing: VoiceLimitEntry[] = Array.from(
            { length: MAX_IMPACT_VOICES },
            (_, index) => ({
                id: index,
                kind: index % 2 === 0 ? 'kill' : 'player-damaged',
                createdOrder: index,
                protected: true
            })
        );
        expect(voiceAdmission(existing, {
            kind: 'swing',
            protected: false
        })).toEqual({ accepted: false, evictedId: null });
    });
});
