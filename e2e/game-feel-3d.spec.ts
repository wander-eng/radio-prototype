import { expect, test, type Page } from '@playwright/test';

async function startGame(page: Page) {
    await page.goto('/');
    await page.waitForFunction(() => Boolean(
        (window as any).__GAME_STATE__ && (window as any).__GAME_TEST__
    ));
    await page.evaluate(() => (window as any).__GAME_TEST__.startGame());
    await page.waitForFunction(() => (window as any).__GAME_STATE__.station === 'forro');
    await page.keyboard.press('Digit1');
    await page.waitForFunction(() => (window as any).__GAME_STATE__.station === 'phonk');
}

async function removeEncounterThreats(page: Page, preserved: string[] = []) {
    await page.evaluate((preservedIds) => {
        const controls = (window as any).__GAME_TEST__;
        for (const id of ['melee_0', 'melee_1', 'ranged_0']) {
            if (!preservedIds.includes(id)) controls.setEnemyHp(id, 0);
        }
    }, preserved);
}

test.describe('Game Feel - Builder 3D camera shake wiring', () => {
    test('a real hit starts one limited shake and returns its offset to zero', async ({ page }) => {
        await startGame(page);
        await removeEncounterThreats(page);
        await page.evaluate(() => {
            const controls = (window as any).__GAME_TEST__;
            controls.setPlayerPosition(0, 1, 4);
            controls.setCombatTargetPosition('target_0', 0, 1, 5.5);
            if (!controls.resolvePlayerAttack()) {
                throw new Error('Ataque do jogador não resolvido');
            }
        });

        await page.waitForFunction(() => {
            const state = (window as any).__GAME_STATE__;
            return state.lastImpactKind === 'normal'
                && state.cameraShakeActive
                && state.cameraShakeImpulseCount === 1
                && state.cameraShakeIntensity > 0
                && state.cameraShakeIntensity <= 0.1;
        });
        await page.waitForFunction(() => {
            const state = (window as any).__GAME_STATE__;
            return !state.cameraShakeActive
                && state.cameraShakeImpulseCount === 0
                && state.cameraShakeIntensity === 0;
        });

        expect(await page.evaluate(() => ({
            active: (window as any).__GAME_STATE__.cameraShakeActive,
            intensity: (window as any).__GAME_STATE__.cameraShakeIntensity
        }))).toEqual({ active: false, intensity: 0 });
    });

    test('pause neutralizes shake without consuming it and resume completes the impulse', async ({ page }) => {
        await startGame(page);
        await removeEncounterThreats(page, ['melee_0']);
        await page.evaluate(() => {
            const controls = (window as any).__GAME_TEST__;
            controls.setPlayerPosition(0, 1, 4);
            controls.setEnemyPosition('melee_0', 0, 1, 5);
        });
        await page.waitForFunction(() =>
            (window as any).__GAME_STATE__.enemies
                .find((enemy: any) => enemy.id === 'melee_0').state === 'windup'
        );
        await page.evaluate(() => {
            if (!(window as any).__GAME_TEST__.resolvePendingMeleeAttack('melee_0')) {
                throw new Error('Ataque melee pendente não resolvido');
            }
        });
        await page.waitForFunction(() => {
            const state = (window as any).__GAME_STATE__;
            return state.lastImpactKind === 'player-damaged'
                && state.cameraShakeActive
                && state.cameraShakeIntensity > 0;
        });
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => {
            const state = (window as any).__GAME_STATE__;
            return state.encounterStatus === 'paused'
                && state.cameraShakeActive
                && state.cameraShakeIntensity === 0;
        });

        await page.keyboard.press('Escape');
        await page.waitForFunction(() =>
            (window as any).__GAME_STATE__.encounterStatus === 'active'
        );
        await page.waitForFunction(() => {
            const state = (window as any).__GAME_STATE__;
            return !state.cameraShakeActive
                && state.cameraShakeImpulseCount === 0
                && state.cameraShakeIntensity === 0;
        });
    });
});
