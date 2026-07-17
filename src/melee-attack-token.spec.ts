import { describe, expect, it } from 'vitest';
import { MeleeAttackToken } from './melee-attack-token';

describe('MeleeAttackToken', () => {
    it('starts free and lets the first melee acquire it', () => {
        const token = new MeleeAttackToken();
        expect(token.ownerId).toBeNull();
        expect(token.tryAcquire('melee_a')).toBe(true);
        expect(token.ownerId).toBe('melee_a');
    });

    it('rejects a second melee while occupied', () => {
        const token = new MeleeAttackToken();
        token.tryAcquire('melee_a');
        expect(token.tryAcquire('melee_b')).toBe(false);
        expect(token.ownerId).toBe('melee_a');
    });

    it('only lets the owner release and supports recovery, death and respawn cleanup', () => {
        const token = new MeleeAttackToken();
        token.tryAcquire('melee_a');
        expect(token.release('melee_b')).toBe(false);
        expect(token.release('melee_a')).toBe(true);
        expect(token.ownerId).toBeNull();

        expect(token.tryAcquire('melee_b')).toBe(true);
        expect(token.release('melee_b')).toBe(true);
        expect(token.ownerId).toBeNull();
    });

    it('clear libera o token de forma idempotente durante reset completo', () => {
        const token = new MeleeAttackToken();
        token.tryAcquire('melee_a');
        token.clear();
        token.clear();
        expect(token.ownerId).toBeNull();
        expect(token.tryAcquire('melee_b')).toBe(true);
    });
});
