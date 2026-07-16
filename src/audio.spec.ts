import { describe, expect, it, vi } from 'vitest';
import { AudioManager } from './audio';

describe('AudioManager restartTrackFromBeginning', () => {
    it('para a instância anterior e inicia uma única nova fonte em 00:00', () => {
        const sources: Array<{ start: ReturnType<typeof vi.fn>, stop: ReturnType<typeof vi.fn> }> = [];
        const context = {
            currentTime: 10,
            destination: {},
            createGain: () => ({
                gain: {
                    value: 0,
                    cancelScheduledValues: vi.fn(),
                    setValueAtTime: vi.fn(),
                    linearRampToValueAtTime: vi.fn()
                },
                connect: vi.fn()
            }),
            createBufferSource: () => {
                const source = {
                    buffer: null,
                    loop: false,
                    connect: vi.fn(),
                    start: vi.fn(),
                    stop: vi.fn()
                };
                sources.push(source);
                return source;
            }
        } as unknown as AudioContext;
        const manager = new AudioManager(context);
        (manager as unknown as { buffers: Map<string, AudioBuffer> }).buffers.set(
            'phonk-transformation',
            {} as AudioBuffer
        );

        manager.restartTrackFromBeginning('phonk-transformation');
        manager.restartTrackFromBeginning('phonk-transformation');

        expect(sources).toHaveLength(2);
        expect(sources[0].stop).toHaveBeenCalledWith(10);
        expect(sources[1].start).toHaveBeenCalledWith(0, 0);
    });
});
