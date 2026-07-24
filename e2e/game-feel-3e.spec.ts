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

async function removeEncounterThreats(page: Page) {
    await page.evaluate(() => {
        const controls = (window as any).__GAME_TEST__;
        for (const id of ['melee_0', 'melee_1', 'ranged_0']) {
            controls.setEnemyHp(id, 0);
        }
    });
}

test.describe('Game Feel - Builder 3E sparks and synthetic audio wiring', () => {
    test('a real hit creates bounded feedback and both counts return to zero', async ({ page }) => {
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
                && state.impactBurstCount === 1
                && state.impactParticleCount === 6
                && state.activeImpactVoiceCount === 1
                && state.activeImpactEffectCount === 2;
        });
        expect(await page.evaluate(() => {
            const state = (window as any).__GAME_STATE__;
            return {
                burstsWithinLimit: state.impactBurstCount <= 12,
                particlesWithinLimit: state.impactParticleCount <= 96,
                voicesWithinLimit: state.activeImpactVoiceCount <= 8
            };
        })).toEqual({
            burstsWithinLimit: true,
            particlesWithinLimit: true,
            voicesWithinLimit: true
        });

        await page.waitForFunction(() => {
            const state = (window as any).__GAME_STATE__;
            return state.impactBurstCount === 0
                && state.impactParticleCount === 0
                && state.activeImpactVoiceCount === 0
                && state.activeImpactEffectCount === 0;
        });
    });

    test('death and revive leave no impact resources active', async ({ page }) => {
        await startGame(page);
        await removeEncounterThreats(page);
        await page.evaluate(() => {
            const controls = (window as any).__GAME_TEST__;
            controls.setPlayerPosition(0, 1, 4);
            controls.setCombatTargetPosition('target_0', 0, 1, 5.5);
            controls.resolvePlayerAttack();
            controls.damagePlayer(100);
        });

        await page.waitForFunction(() => {
            const state = (window as any).__GAME_STATE__;
            return state.deathOverlayVisible
                && state.impactBurstCount === 0
                && state.impactParticleCount === 0
                && state.activeImpactVoiceCount === 0;
        });
        await page.evaluate(() => (window as any).__GAME_TEST__.revivePlayer());
        await page.waitForFunction(() => {
            const state = (window as any).__GAME_STATE__;
            return !state.deathOverlayVisible
                && state.encounterStatus === 'active'
                && state.activeImpactEffectCount === 0;
        });
    });
});
