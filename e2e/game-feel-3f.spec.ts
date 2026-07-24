import { expect, test, type Page } from '@playwright/test';

async function startGame(page: Page) {
    await page.goto('/');
    await page.waitForFunction(() => Boolean(
        (window as any).__GAME_STATE__ && (window as any).__GAME_TEST__
    ));
    await page.evaluate(() => (window as any).__GAME_TEST__.startGame());
    await page.waitForFunction(() => (window as any).__GAME_STATE__.station === 'forro');
    await page.evaluate(() => {
        const controls = (window as any).__GAME_TEST__;
        for (const id of ['melee_0', 'melee_1', 'ranged_0']) {
            controls.setEnemyHp(id, 0);
        }
        controls.setPlayerPosition(0, 1, 4);
        controls.setCombatTargetPosition('target_1', 12, 1, 12);
    });
}

async function selectStation(
    page: Page,
    station: 'phonk' | 'samba' | 'forro'
) {
    const key = station === 'phonk'
        ? 'Digit1'
        : station === 'samba' ? 'Digit2' : 'Digit3';
    await page.keyboard.press(key);
    await page.waitForFunction(
        expected => (window as any).__GAME_STATE__.station === expected,
        station
    );
}

async function resolveHit(page: Page) {
    const previous = await page.evaluate(() =>
        (window as any).__GAME_STATE__.lastImpactActionId
    );
    await page.evaluate(() => {
        const controls = (window as any).__GAME_TEST__;
        controls.setPlayerPosition(0, 1, 4);
        controls.setCombatTargetPosition('target_0', 0, 1, 5.5);
        if (!controls.resolvePlayerAttack()) {
            throw new Error('Ataque do jogador não resolvido');
        }
    });
    await page.waitForFunction(
        actionId => (window as any).__GAME_STATE__.lastImpactActionId !== actionId,
        previous
    );
}

test.describe('Game Feel - Builder 3F station impact presets', () => {
    test('real impacts select distinct station presets and transformed presence stays bounded', async ({ page }) => {
        await startGame(page);

        for (const station of ['phonk', 'samba', 'forro'] as const) {
            await selectStation(page, station);
            await resolveHit(page);
            const snapshot = await page.evaluate(() => {
                const state = (window as any).__GAME_STATE__;
                return {
                    preset: state.lastImpactPreset,
                    station: state.lastImpactStation,
                    transformed: state.lastImpactTransformed
                };
            });
            expect(snapshot).toEqual({
                preset: `${station}:normal:base`,
                station,
                transformed: false
            });
        }

        await page.evaluate(() => (window as any).__GAME_TEST__.setEnergy(100));
        await page.keyboard.press('KeyR');
        await page.waitForFunction(() => (window as any).__GAME_STATE__.transformed);
        await resolveHit(page);

        const transformed = await page.evaluate(() => {
            const state = (window as any).__GAME_STATE__;
            return {
                preset: state.lastImpactPreset,
                station: state.lastImpactStation,
                transformed: state.lastImpactTransformed,
                bursts: state.impactBurstCount,
                particles: state.impactParticleCount,
                voices: state.activeImpactVoiceCount,
                shake: state.cameraShakeIntensity
            };
        });
        expect(transformed).toMatchObject({
            preset: 'forro:normal:transformed',
            station: 'forro',
            transformed: true
        });
        expect(transformed.bursts).toBeLessThanOrEqual(12);
        expect(transformed.particles).toBeLessThanOrEqual(96);
        expect(transformed.voices).toBeLessThanOrEqual(8);
        expect(transformed.shake).toBeLessThanOrEqual(0.1);

        await page.evaluate(() => (window as any).__GAME_TEST__.resetEncounter());
        await page.waitForFunction(() =>
            (window as any).__GAME_STATE__.lastImpactPreset === null
        );
    });
});
