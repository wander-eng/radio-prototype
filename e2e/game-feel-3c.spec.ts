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

test.describe('Game Feel - Builder 3C local reactions', () => {
    test('a real hit flashes and displaces a melee without losing its telegraph', async ({ page }) => {
        await startGame(page);
        await removeEncounterThreats(page, ['melee_0']);
        await page.evaluate(() => {
            const controls = (window as any).__GAME_TEST__;
            controls.setPlayerPosition(0, 1, 4);
            controls.setEnemyPosition('melee_0', 0, 1, 5);
        });
        await page.waitForFunction(() => {
            const enemy = (window as any).__GAME_STATE__.enemies
                .find((candidate: any) => candidate.id === 'melee_0');
            return enemy?.state === 'windup' && enemy.telegraphActive;
        });

        const before = await page.evaluate(() => {
            const enemy = (window as any).__GAME_STATE__.enemies
                .find((candidate: any) => candidate.id === 'melee_0');
            return { x: enemy.x, z: enemy.z };
        });
        await page.evaluate(() => {
            if (!(window as any).__GAME_TEST__.resolvePlayerAttack()) {
                throw new Error('Ataque do jogador não resolvido');
            }
        });

        await page.waitForFunction(() => {
            const state = (window as any).__GAME_STATE__;
            const enemy = state.enemies.find((candidate: any) => candidate.id === 'melee_0');
            return state.flashingEntityIds.includes('melee_0')
                && state.knockbackEntityIds.includes('melee_0')
                && enemy.telegraphActive;
        });
        await page.waitForFunction(() => {
            const state = (window as any).__GAME_STATE__;
            const enemy = state.enemies.find((candidate: any) => candidate.id === 'melee_0');
            return !state.flashingEntityIds.includes('melee_0')
                && !state.knockbackEntityIds.includes('melee_0')
                && enemy.telegraphActive;
        });

        const after = await page.evaluate(() => {
            const enemy = (window as any).__GAME_STATE__.enemies
                .find((candidate: any) => candidate.id === 'melee_0');
            return { x: enemy.x, z: enemy.z, state: enemy.state };
        });
        expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(0);
        expect(after.state).toBe('windup');
    });

    test('accepted player damage flashes without displacement and ignored damage adds no reaction', async ({ page }) => {
        await startGame(page);
        await removeEncounterThreats(page, ['melee_0', 'melee_1']);
        await page.evaluate(() => {
            const controls = (window as any).__GAME_TEST__;
            controls.setPlayerPosition(0, 1, 4);
            controls.setEnemyPosition('melee_0', 0, 1, 5);
            controls.setEnemyPosition('melee_1', 12, 1, 12);
        });
        await page.waitForFunction(() =>
            (window as any).__GAME_STATE__.enemies
                .find((enemy: any) => enemy.id === 'melee_0').state === 'windup'
        );
        const playerPosition = await page.evaluate(() => ({
            ...(window as any).__GAME_STATE__.player.position
        }));
        await page.evaluate(() => {
            if (!(window as any).__GAME_TEST__.resolvePendingMeleeAttack('melee_0')) {
                throw new Error('Ataque melee pendente não resolvido');
            }
        });
        await page.waitForFunction(() => {
            const state = (window as any).__GAME_STATE__;
            return state.lastImpactKind === 'player-damaged'
                && state.flashingEntityIds.includes('player');
        });

        const acceptedActionId = await page.evaluate(() =>
            (window as any).__GAME_STATE__.lastImpactActionId
        );
        expect(await page.evaluate(() =>
            (window as any).__GAME_STATE__.knockbackEntityIds.includes('player')
        )).toBe(false);
        expect(await page.evaluate(() =>
            (window as any).__GAME_STATE__.player.position
        )).toEqual(playerPosition);

        await page.waitForFunction(() =>
            !(window as any).__GAME_STATE__.flashingEntityIds.includes('player')
        );
        await page.evaluate(() => {
            const controls = (window as any).__GAME_TEST__;
            controls.setEnemyPosition('melee_1', 0, 1, 5);
            controls.advanceEncounter(0);
            if (!controls.resolvePendingMeleeAttack('melee_1')) {
                throw new Error('Segundo ataque melee pendente não resolvido');
            }
        });

        await expect.poll(() => page.evaluate(() => ({
            actionId: (window as any).__GAME_STATE__.lastImpactActionId,
            flashing: (window as any).__GAME_STATE__.flashingEntityIds.includes('player')
        }))).toEqual({ actionId: acceptedActionId, flashing: false });
    });
});
