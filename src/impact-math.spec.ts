import { describe, expect, it } from 'vitest';
import type { PlayerAttackDecision } from './combat-math';
import {
    classifyOffensiveImpact,
    classifyPlayerAttackImpact,
    phonkImpactReachesDamageCap
} from './impact-math';
import {
    createImpactActionIdSource,
    createImpactEvent,
    ImpactEventStore,
    type ImpactTargetResult
} from './impact-event';

const target = (
    targetId: string,
    killed: boolean = false,
    damageAccepted: number = 10
): ImpactTargetResult => ({
    targetId,
    position: { x: 1, y: 2, z: 3 },
    damageAccepted,
    killed
});

const playerDecision = (
    outcome: PlayerAttackDecision['outcome']
): PlayerAttackDecision => ({
    hp: outcome === 'damage-applied' ? 80 : 100,
    damageApplied: outcome === 'damage-applied' ? 20 : 0,
    killed: false,
    outcome,
    ignoredByInvulnerability: outcome === 'ignored-global-invulnerability',
    dodgedBySamba: outcome === 'dodged-samba',
    threatConsumed: !['ignored-dead', 'ignored-invalid'].includes(outcome)
});

describe('impact classification', () => {
    it('classifies miss and normal without allowing both in the same action', () => {
        expect(classifyOffensiveImpact({
            source: 'basic-attack',
            station: 'phonk',
            targets: []
        })).toBe('miss');
        expect(classifyOffensiveImpact({
            source: 'basic-attack',
            station: 'phonk',
            targets: [target('enemy')]
        })).toBe('normal');
        expect(classifyOffensiveImpact({
            source: 'forro-dash',
            station: 'forro',
            targets: []
        })).toBeNull();
    });

    it('uses the existing Phonk multiplier to detect reaching or using the cap', () => {
        expect(phonkImpactReachesDamageCap(4, 1)).toBe(false);
        expect(phonkImpactReachesDamageCap(5, 1)).toBe(true);
        expect(phonkImpactReachesDamageCap(8, 1)).toBe(true);
        expect(phonkImpactReachesDamageCap(8, 0)).toBe(false);

        expect(classifyOffensiveImpact({
            source: 'basic-attack',
            station: 'phonk',
            targets: [target('enemy')],
            phonkReachedDamageCap: true
        })).toBe('phonk-strong');
    });

    it('classifies Samba counter only when the valid hit consumed it', () => {
        expect(classifyOffensiveImpact({
            source: 'basic-attack',
            station: 'samba',
            targets: [target('enemy')],
            sambaCounterConsumed: true
        })).toBe('samba-counter');
    });

    it('aggregates Forro targets and only classifies multi with two accepted hits', () => {
        expect(classifyOffensiveImpact({
            source: 'basic-attack',
            station: 'forro',
            targets: [target('enemy_a')]
        })).toBe('normal');
        expect(classifyOffensiveImpact({
            source: 'basic-attack',
            station: 'forro',
            targets: [target('enemy_a'), target('enemy_b')]
        })).toBe('forro-multi');
    });

    const killPriorityCases: Array<[
        string,
        {
            station: 'phonk' | 'samba' | 'forro';
            phonkReachedDamageCap?: boolean;
            sambaCounterConsumed?: boolean;
            secondTarget?: boolean;
        }
    ]> = [
        ['normal', { station: 'forro' as const }],
        ['Phonk strong', { station: 'phonk' as const, phonkReachedDamageCap: true }],
        ['Samba counter', { station: 'samba' as const, sambaCounterConsumed: true }],
        ['Forro multi', { station: 'forro' as const, secondTarget: true }]
    ];

    it.each(killPriorityCases)('lets enemy kill replace %s', (_label, options) => {
        const targets = [
            target('enemy_a', true),
            ...(options.secondTarget ? [target('enemy_b')] : [])
        ];
        expect(classifyOffensiveImpact({
            source: 'basic-attack',
            station: options.station,
            targets,
            phonkReachedDamageCap: options.phonkReachedDamageCap,
            sambaCounterConsumed: options.sambaCounterConsumed
        })).toBe('enemy-kill');
    });

    it('does not use transformation as an impact category', () => {
        const base = createImpactEvent({
            actionId: 1,
            kind: 'normal',
            source: 'basic-attack',
            station: 'phonk',
            transformed: false,
            origin: { x: 0, y: 1, z: 0 },
            direction: { x: 0, y: 0, z: 1 },
            targets: [target('enemy')]
        });
        const transformed = createImpactEvent({ ...base, transformed: true });
        expect(transformed.kind).toBe(base.kind);
    });
});

describe('incoming impact classification', () => {
    it('maps accepted player damage and real Samba dodge', () => {
        expect(classifyPlayerAttackImpact(playerDecision('damage-applied'))).toBe('player-damaged');
        expect(classifyPlayerAttackImpact(playerDecision('dodged-samba'))).toBe('samba-dodge');
    });

    it.each([
        'ignored-global-invulnerability',
        'ignored-dead',
        'ignored-invalid'
    ] as const)('does not emit an impact for %s', (outcome) => {
        expect(classifyPlayerAttackImpact(playerDecision(outcome))).toBeNull();
    });
});

describe('impact event contract', () => {
    it('creates deterministic unique action IDs', () => {
        const nextActionId = createImpactActionIdSource();
        expect([nextActionId(), nextActionId(), nextActionId()]).toEqual([1, 2, 3]);
    });

    it('keeps a Forro action global while sharing its actionId across target results', () => {
        const event = createImpactEvent({
            actionId: 7,
            kind: 'forro-multi',
            source: 'forro-dash',
            station: 'forro',
            transformed: false,
            origin: { x: 0, y: 1, z: 0 },
            direction: { x: 0, y: 0, z: 1 },
            targets: [target('enemy_a'), target('enemy_b')]
        });

        expect(event.actionId).toBe(7);
        expect(event.targets).toHaveLength(2);
        expect(new Set(event.targets.map(() => event.actionId))).toEqual(new Set([7]));
    });

    it('produces an immutable JSON-serializable payload without Three.js objects', () => {
        const event = createImpactEvent({
            actionId: 9,
            kind: 'normal',
            source: 'basic-attack',
            station: 'samba',
            transformed: true,
            origin: { x: 0, y: 1, z: 2 },
            direction: { x: 1, y: 0, z: 0 },
            targets: [target('enemy')]
        });

        expect(JSON.parse(JSON.stringify(event))).toEqual(event);
        expect(Object.isFrozen(event)).toBe(true);
        expect(Object.isFrozen(event.targets)).toBe(true);
        expect(Object.isFrozen(event.targets[0].position)).toBe(true);
        expect(JSON.stringify(event)).not.toContain('Object3D');
        expect(JSON.stringify(event)).not.toContain('Mesh');
    });

    it('clears provisional observability on reset', () => {
        const store = new ImpactEventStore();
        store.record(createImpactEvent({
            actionId: 1,
            kind: 'normal',
            source: 'basic-attack',
            station: 'phonk',
            transformed: false,
            origin: { x: 0, y: 1, z: 0 },
            direction: { x: 0, y: 0, z: 1 },
            targets: [target('enemy')]
        }));
        expect(store.lastImpact?.kind).toBe('normal');
        store.reset();
        expect(store.lastImpact).toBeNull();
    });
});
