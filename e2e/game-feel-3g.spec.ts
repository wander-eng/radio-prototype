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

async function waitForImpactEffectsToExpire(page: Page) {
    await page.waitForFunction(() => {
        const state = (window as any).__GAME_STATE__;
        return !state.hitstopActive
            && state.effectiveTimeScale === 1
            && !state.cameraShakeActive
            && state.flashingEntityIds.length === 0
            && state.knockbackEntityIds.length === 0
            && state.impactBurstCount === 0
            && state.impactParticleCount === 0
            && state.activeImpactVoiceCount === 0
            && state.activeImpactEffectCount === 0;
    });
}

async function resolveMeleeHit(page: Page) {
    const previousActionId = await page.evaluate(() =>
        (window as any).__GAME_STATE__.lastImpactActionId
    );
    await page.evaluate(() => {
        const controls = (window as any).__GAME_TEST__;
        controls.setPlayerPosition(0, 1, 4);
        controls.setEnemyPosition('melee_0', 0, 1, 5.5);
        if (!controls.resolvePlayerAttack()) {
            throw new Error('Ataque do jogador não resolvido');
        }
    });
    await page.waitForFunction(
        actionId => (window as any).__GAME_STATE__.lastImpactActionId !== actionId,
        previousActionId
    );
}

test.describe('Game Feel - Builder 3G observability and lifecycle', () => {
    test('repeated real impacts and death/revive return every observable effect to baseline', async ({ page }) => {
        await startGame(page);

        for (let cycle = 0; cycle < 3; cycle++) {
            await page.evaluate(() => {
                const controls = (window as any).__GAME_TEST__;
                controls.resetEncounter();
                controls.setEnemyHp('melee_1', 0);
                controls.setEnemyHp('ranged_0', 0);
            });
            await resolveMeleeHit(page);
            await page.waitForFunction(() => {
                const state = (window as any).__GAME_STATE__;
                return state.lastImpactKind === 'normal'
                    && state.lastImpactIntensity === 2
                    && state.lastImpactPreset === 'phonk:normal:base';
            });
            await waitForImpactEffectsToExpire(page);
        }

        await page.evaluate(() => {
            const controls = (window as any).__GAME_TEST__;
            controls.resetEncounter();
        });
        await page.keyboard.press('Digit3');
        await page.waitForFunction(() => (window as any).__GAME_STATE__.station === 'forro');
        await page.evaluate(() => {
            const controls = (window as any).__GAME_TEST__;
            controls.setEnemyHp('ranged_0', 0);
            controls.setPlayerPosition(0, 1, 4);
            controls.setEnemyPosition('melee_0', -0.35, 1, 5.5);
            controls.setEnemyPosition('melee_1', 0.35, 1, 5.5);
            if (!controls.resolvePlayerAttack()) {
                throw new Error('Ataque Forró não resolvido');
            }
        });
        await page.waitForFunction(() => {
            const state = (window as any).__GAME_STATE__;
            return state.lastImpactKind === 'forro-multi'
                && state.lastImpactIntensity === 4
                && state.lastImpact.targets.length === 2
                && state.cameraShakeImpulseCount === 1
                && state.impactBurstCount <= 12
                && state.impactParticleCount <= 96
                && state.activeImpactVoiceCount <= 8;
        });
        await waitForImpactEffectsToExpire(page);

        await page.evaluate(() => {
            const controls = (window as any).__GAME_TEST__;
            controls.setEnergy(100);
        });
        await page.keyboard.press('KeyR');
        await page.waitForFunction(() => (window as any).__GAME_STATE__.transformed);
        await page.evaluate(() => (window as any).__GAME_TEST__.damagePlayer(100));
        await page.waitForFunction(() => {
            const state = (window as any).__GAME_STATE__;
            return state.deathOverlayVisible
                && state.encounterFrozen
                && state.lastImpactKind === 'forro-multi'
                && state.lastImpactIntensity === 4
                && !state.hitstopActive
                && !state.cameraShakeActive
                && state.flashingEntityIds.length === 0
                && state.knockbackEntityIds.length === 0
                && state.activeImpactEffectCount === 0;
        });

        await page.evaluate(() => (window as any).__GAME_TEST__.revivePlayer());
        await page.waitForFunction(() => {
            const state = (window as any).__GAME_STATE__;
            return state.encounterStatus === 'active'
                && !state.deathOverlayVisible
                && !state.transformed
                && state.energy === 0
                && state.lastImpact === null
                && state.lastImpactIntensity === null
                && state.effectiveTimeScale === 1
                && state.activeTimeSources.length === 0
                && !state.cameraShakeActive
                && state.flashingEntityIds.length === 0
                && state.knockbackEntityIds.length === 0
                && state.impactBurstCount === 0
                && state.impactParticleCount === 0
                && state.activeImpactVoiceCount === 0
                && state.activeImpactEffectCount === 0;
        });

        const finalState = await page.evaluate(() => {
            const state = (window as any).__GAME_STATE__;
            return {
                station: state.station,
                playerHp: state.player.hp,
                playerPosition: state.player.position,
                enemyCount: state.enemies.length,
                projectileCount: state.projectileCount,
                meleeAttackOwnerId: state.meleeAttackOwnerId
            };
        });
        expect(finalState).toEqual({
            station: 'forro',
            playerHp: 100,
            playerPosition: { x: 0, y: 1, z: 4 },
            enemyCount: 3,
            projectileCount: 0,
            meleeAttackOwnerId: null
        });
    });
});
