import { describe, expect, it } from 'vitest';
import { energyHudState, HUD_CONTROL_HINTS } from './hud';

describe('energyHudState', () => {
    it('identifica energia vazia', () => {
        expect(energyHudState(0)).toBe('empty');
        expect(energyHudState(-10)).toBe('empty');
    });

    it('identifica carga em progresso', () => {
        expect(energyHudState(1)).toBe('charging');
        expect(energyHudState(50)).toBe('charging');
        expect(energyHudState(99)).toBe('charging');
    });

    it('identifica energia cheia', () => {
        expect(energyHudState(100)).toBe('full');
        expect(energyHudState(120)).toBe('full');
    });
});

describe('HUD_CONTROL_HINTS', () => {
    it('inclui transformação por R sem remover os controles existentes', () => {
        const controls = HUD_CONTROL_HINTS.join(' ');

        expect(controls).toContain('Mover:');
        expect(controls).toContain('Ataque:');
        expect(controls).toContain('Pular:');
        expect(controls).toContain('Dash:');
        expect(controls).toContain('Rádio:');
        expect(controls).toContain('Transformação: <kbd>R</kbd>');
        expect(controls).toContain('Pausar:');
    });
});
