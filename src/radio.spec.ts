import { describe, expect, it } from 'vitest';
import { canChangeStation } from './radio';

describe('canChangeStation', () => {
    it('bloqueia troca enquanto transformado', () => {
        expect(canChangeStation(true)).toBe(false);
    });

    it('reativa troca depois que a transformação termina', () => {
        expect(canChangeStation(false)).toBe(true);
    });
});
