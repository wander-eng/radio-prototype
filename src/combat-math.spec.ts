import { describe, it, expect } from 'vitest';
import { phonkDamageMultiplier, sambaDamage, forroSweepHit } from './combat-math';

describe('Combat Math', () => {
    describe('phonkDamageMultiplier', () => {
        it('combo=0 -> 1.0', () => {
            expect(phonkDamageMultiplier(0)).toBe(1.0);
        });
        it('combo=1 -> 1.05', () => {
            expect(phonkDamageMultiplier(1)).toBe(1.05);
        });
        it('combo=3 -> 1.15', () => {
            expect(phonkDamageMultiplier(3)).toBe(1.15);
        });
        it('combo=6 -> 1.30 (teto atingido)', () => {
            expect(phonkDamageMultiplier(6)).toBe(1.30);
        });
        it('combo=10 -> 1.30 (continua no teto)', () => {
            expect(phonkDamageMultiplier(10)).toBe(1.30);
        });
    });

    describe('sambaDamage', () => {
        it('sambaDamage(10, false) -> 10', () => {
            expect(sambaDamage(10, false)).toBe(10);
        });
        it('sambaDamage(10, true) -> 15', () => {
            expect(sambaDamage(10, true)).toBe(15);
        });
        it('sambaDamage(20, true) -> 30', () => {
            expect(sambaDamage(20, true)).toBe(30);
        });
    });

    describe('forroSweepHit', () => {
        const attackOrigin = { x: 0, z: 0 };
        const forward = { x: 0, z: 1 };

        it('target {x:0, z:0.5} (colado no jogador) -> true', () => {
            expect(forroSweepHit({ x: 0, z: 0.5 }, attackOrigin, forward)).toBe(true);
        });
        it('target {x:0, z:2.4} (na ponta do alcance) -> true', () => {
            expect(forroSweepHit({ x: 0, z: 2.4 }, attackOrigin, forward)).toBe(true);
        });
        it('target {x:0, z:5} (longe demais) -> false', () => {
            expect(forroSweepHit({ x: 0, z: 5 }, attackOrigin, forward)).toBe(false);
        });
        it('target {x:1.5, z:0} (do lado, fora do cone do golpe) -> false', () => {
            expect(forroSweepHit({ x: 1.5, z: 0 }, attackOrigin, forward)).toBe(false);
        });
    });
});