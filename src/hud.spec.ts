import { describe, expect, it } from 'vitest';
import {
    DEATH_OVERLAY_COPY,
    DeathOverlayGate,
    energyHudState,
    HUD_AUDIO_DEFAULTS,
    HUD_CONTROL_HINTS
} from './hud';

describe('HUD_AUDIO_DEFAULTS', () => {
    it('inicia música em 15% e preserva SFX em 100%', () => {
        expect(HUD_AUDIO_DEFAULTS).toEqual({ music: 0.15, sfx: 1 });
    });
});

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

describe('DeathOverlayGate', () => {
    it('abre a tela de morte e aceita somente uma retomada por ciclo', () => {
        const gate = new DeathOverlayGate();

        gate.open();
        expect(gate.visible).toBe(true);
        expect(gate.reviveInProgress).toBe(false);
        expect(gate.tryBeginRevive()).toBe(true);
        expect(gate.tryBeginRevive()).toBe(false);
        expect(gate.reviveInProgress).toBe(true);
    });

    it('fecha somente ao completar e volta ao estado correto em uma morte futura', () => {
        const gate = new DeathOverlayGate();

        gate.open();
        gate.tryBeginRevive();
        expect(gate.visible).toBe(true);
        gate.completeRevive();
        expect(gate.visible).toBe(false);
        expect(gate.reviveInProgress).toBe(false);

        gate.open();
        expect(gate.visible).toBe(true);
        expect(gate.tryBeginRevive()).toBe(true);
    });

    it('mantem o texto obrigatorio do overlay', () => {
        expect(DEATH_OVERLAY_COPY).toEqual({
            title: 'Você morreu!',
            prompt: 'Tentar de novo?',
            action: 'Reviver'
        });
    });
});
