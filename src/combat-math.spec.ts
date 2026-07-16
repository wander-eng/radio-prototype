import { describe, it, expect } from 'vitest';
import {
    auraIntensity,
    auraIntensityForState,
    canTransform,
    clampEnergy,
    drainTransformationEnergy,
    energyGainForAttack,
    energyGainForHit,
    forroSweepHit,
    phonkDamageMultiplier,
    sambaDamage
} from './combat-math';

describe('Combat Math', () => {
    describe('energyGainForHit', () => {
        it('concede 2 para hit básico', () => {
            expect(energyGainForHit('basic')).toBe(2);
        });

        it('concede os mesmos 2 para hit especial', () => {
            expect(energyGainForHit('special')).toBe(2);
        });
    });

    describe('energyGainForAttack', () => {
        it('concede 2 uma única vez independentemente do número de alvos', () => {
            expect(energyGainForAttack(1, false)).toBe(2);
            expect(energyGainForAttack(2, false)).toBe(2);
            expect(energyGainForAttack(3, false)).toBe(2);
        });

        it('não concede energia sem acerto ou durante a transformação', () => {
            expect(energyGainForAttack(0, false)).toBe(0);
            expect(energyGainForAttack(1, true)).toBe(0);
            expect(energyGainForAttack(3, true)).toBe(0);
        });
    });

    describe('clampEnergy', () => {
        it('soma o ganho à energia atual', () => {
            expect(clampEnergy(20, 2)).toBe(22);
        });

        it('limita o resultado ao máximo de 100', () => {
            expect(clampEnergy(99, 2)).toBe(100);
        });

        it('limita o resultado ao mínimo de 0', () => {
            expect(clampEnergy(5, -10)).toBe(0);
        });
    });

    describe('auraIntensity', () => {
        it('converte energia para intensidade linear', () => {
            expect(auraIntensity(0)).toBe(0);
            expect(auraIntensity(50)).toBe(0.5);
            expect(auraIntensity(100)).toBe(1);
        });

        it('limita a intensidade ao intervalo entre 0 e 1', () => {
            expect(auraIntensity(-10)).toBe(0);
            expect(auraIntensity(120)).toBe(1);
        });
    });

    describe('auraIntensityForState', () => {
        it('usa energia / 100 no estado base', () => {
            expect(auraIntensityForState(0, false)).toBe(0);
            expect(auraIntensityForState(50, false)).toBe(0.5);
        });

        it('permanece máxima durante toda a transformação', () => {
            expect(auraIntensityForState(100, true)).toBe(1);
            expect(auraIntensityForState(50, true)).toBe(1);
            expect(auraIntensityForState(0, true)).toBe(1);
        });

        it('volta a zero ao encerrar transformado com energia zero', () => {
            expect(auraIntensityForState(0, false)).toBe(0);
        });
    });

    describe('canTransform', () => {
        it('aceita energia exatamente cheia', () => {
            expect(canTransform(100)).toBe(true);
        });

        it('recusa qualquer energia abaixo de 100', () => {
            expect(canTransform(0)).toBe(false);
            expect(canTransform(99)).toBe(false);
            expect(canTransform(99.999)).toBe(false);
        });
    });

    describe('drainTransformationEnergy', () => {
        it('consome 100 de energia em 15 segundos', () => {
            expect(drainTransformationEnergy(100, 7.5)).toBeCloseTo(50);
            expect(drainTransformationEnergy(100, 15)).toBe(0);
        });

        it('limita o resultado ao mínimo de zero', () => {
            expect(drainTransformationEnergy(10, 15)).toBe(0);
            expect(drainTransformationEnergy(0, 1)).toBe(0);
        });

        it('produz o mesmo consumo com deltas menores', () => {
            let sixtyFrames = 100;
            for (let frame = 0; frame < 60; frame++) {
                sixtyFrames = drainTransformationEnergy(sixtyFrames, 1 / 60);
            }
            const oneFrame = drainTransformationEnergy(100, 1);

            expect(sixtyFrames).toBeCloseTo(oneFrame, 10);
        });
    });

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
