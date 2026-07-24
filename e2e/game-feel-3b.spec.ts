import { expect, test, type Page } from '@playwright/test';

async function startGame(page: Page, station: 'phonk' | 'samba') {
    await page.goto('/');
    await page.waitForFunction(() => Boolean(
        (window as any).__GAME_STATE__ && (window as any).__GAME_TEST__
    ));
    await page.evaluate(() => (window as any).__GAME_TEST__.startGame());
    await page.waitForFunction(() => (window as any).__GAME_STATE__.station === 'forro');

    await page.keyboard.press(station === 'phonk' ? 'Digit1' : 'Digit2');
    await page.waitForFunction(
        (expected) => (window as any).__GAME_STATE__.station === expected,
        station
    );
}

async function removeEncounterThreats(page: Page, preserved: string[] = []) {
    await page.evaluate((preservedIds) => {
        const controls = (window as any).__GAME_TEST__;
        for (const id of ['melee_0', 'melee_1', 'ranged_0']) {
            if (!preservedIds.includes(id)) controls.setEnemyHp(id, 0);
        }
    }, preserved);
}

test.describe('Game Feel - Builder 3B combat time wiring', () => {
    test('a real hit starts hitstop and returns gameplay scale to one', async ({ page }) => {
        await startGame(page, 'phonk');
        await removeEncounterThreats(page);

        await page.evaluate(() => {
            const controls = (window as any).__GAME_TEST__;
            controls.setPlayerPosition(0, 1, 4);
            controls.setCombatTargetPosition('target_0', 0, 1, 5.5);
            if (!controls.resolvePlayerAttack()) throw new Error('Ataque não resolvido');
        });

        await page.waitForFunction(() => {
            const state = (window as any).__GAME_STATE__;
            return state.lastImpactKind === 'normal'
                && state.hitstopActive
                && state.effectiveTimeScale === 0
                && state.activeTimeSources.includes('hitstop');
        });

        const actionId = await page.evaluate(() =>
            (window as any).__GAME_STATE__.lastImpactActionId
        );
        await page.waitForFunction((expectedActionId) => {
            const state = (window as any).__GAME_STATE__;
            return state.lastImpactActionId === expectedActionId
                && !state.hitstopActive
                && state.effectiveTimeScale === 1
                && state.activeTimeSources.length === 0;
        }, actionId);

        expect(await page.evaluate(() =>
            (window as any).__GAME_STATE__.effectiveTimeScale
        )).toBe(1);
    });

    test('Samba slow motion survives hitstop and both sources finish cleanly', async ({ page }) => {
        await startGame(page, 'samba');
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
            const controls = (window as any).__GAME_TEST__;
            controls.openSambaDodgeWindow();
            if (!controls.resolvePendingMeleeAttack('melee_0')) {
                throw new Error('Ataque melee pendente não resolvido');
            }
            if (!controls.resolvePlayerAttack()) throw new Error('Counter não resolvido');
        });

        await page.waitForFunction(() => {
            const state = (window as any).__GAME_STATE__;
            return state.lastImpactKind === 'samba-counter'
                && state.hitstopActive
                && state.slowMotionActive
                && state.effectiveTimeScale === 0
                && state.activeTimeSources.includes('hitstop')
                && state.activeTimeSources.includes('samba-slow-motion');
        });

        await page.waitForFunction(() => {
            const state = (window as any).__GAME_STATE__;
            return !state.hitstopActive
                && state.slowMotionActive
                && state.effectiveTimeScale === 0.5
                && state.activeTimeSources.length === 1
                && state.activeTimeSources[0] === 'samba-slow-motion';
        });

        await page.waitForFunction(() => {
            const state = (window as any).__GAME_STATE__;
            return !state.hitstopActive
                && !state.slowMotionActive
                && state.effectiveTimeScale === 1
                && state.activeTimeSources.length === 0;
        });
    });
});
