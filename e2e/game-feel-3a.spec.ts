import { expect, test, type Page } from '@playwright/test';

async function startGame(page: Page, station: 'phonk' | 'samba' | 'forro') {
    await page.goto('/');
    await page.waitForFunction(() => Boolean(
        (window as any).__GAME_STATE__ && (window as any).__GAME_TEST__
    ));
    await page.evaluate(() => (window as any).__GAME_TEST__.startGame());
    await page.waitForFunction(() => (window as any).__GAME_STATE__.station === 'forro');
    const key = station === 'phonk' ? 'Digit1' : station === 'samba' ? 'Digit2' : 'Digit3';
    if (key !== 'Digit3') {
        await page.keyboard.press(key);
        await page.waitForFunction(
            (expected) => (window as any).__GAME_STATE__.station === expected,
            station
        );
    }
}

async function removeEncounterThreats(page: Page, except: string[] = []) {
    await page.evaluate((preserved) => {
        const controls = (window as any).__GAME_TEST__;
        for (const id of ['melee_0', 'melee_1', 'ranged_0']) {
            if (!preserved.includes(id)) controls.setEnemyHp(id, 0);
        }
    }, except);
}

test.describe('Game Feel - Builder 3A impact contract', () => {
    test('records miss, transformed normal hit and reset using serializable data', async ({ page }) => {
        await startGame(page, 'phonk');
        await removeEncounterThreats(page);
        await page.evaluate(() => {
            const controls = (window as any).__GAME_TEST__;
            controls.setPlayerPosition(10, 1, 10);
            if (!controls.resolvePlayerAttack()) throw new Error('Ataque do jogador não resolvido');
        });
        await page.waitForFunction(() => (window as any).__GAME_STATE__.lastImpactKind === 'miss');

        const miss = await page.evaluate(() => (window as any).__GAME_STATE__);
        expect(miss.lastImpactKind).toBe('miss');
        expect(miss.lastImpact).toMatchObject({
            source: 'basic-attack',
            station: 'phonk',
            transformed: false,
            targets: []
        });
        expect(JSON.parse(JSON.stringify(miss.lastImpact))).toEqual(miss.lastImpact);

        await page.evaluate(() => {
            const controls = (window as any).__GAME_TEST__;
            controls.setEnergy(100);
            controls.setPlayerPosition(-3, 1, -6.5);
            controls.setCombatTargetPosition('target_0', -3, 1, -5);
        });
        await page.keyboard.press('KeyR');
        await page.waitForFunction(() => (window as any).__GAME_STATE__.transformed);
        const previousImpact = await page.evaluate(() =>
            (window as any).__GAME_STATE__.lastImpactActionId
        );
        await page.evaluate(() => {
            if (!(window as any).__GAME_TEST__.resolvePlayerAttack()) {
                throw new Error('Ataque do jogador não resolvido');
            }
        });
        await page.waitForFunction(
            (previous) => (window as any).__GAME_STATE__.lastImpactActionId !== previous,
            previousImpact
        );

        const hit = await page.evaluate(() => (window as any).__GAME_STATE__.lastImpact);
        expect(hit).toMatchObject({
            kind: 'normal',
            source: 'basic-attack',
            station: 'phonk',
            transformed: true,
            origin: { x: -3, y: 1, z: -6.5 },
            targets: [{ targetId: 'target_0', damageAccepted: 10 }]
        });

        await page.evaluate(() => (window as any).__GAME_TEST__.resetEncounter());
        await page.waitForFunction(() => (window as any).__GAME_STATE__.lastImpactKind === null);
        expect(await page.evaluate(() => (window as any).__GAME_STATE__.lastImpact)).toBeNull();
    });

    test('classifies Phonk cap and Samba counter through real attacks', async ({ page }) => {
        await startGame(page, 'phonk');
        await removeEncounterThreats(page);
        await page.evaluate(() => (window as any).__GAME_TEST__.setPlayerPosition(-3, 1, -6.5));

        for (let hit = 0; hit < 6; hit++) {
            const previous = await page.evaluate(() =>
                (window as any).__GAME_STATE__.lastImpactActionId
            );
            await page.evaluate(() => {
                const controls = (window as any).__GAME_TEST__;
                controls.setCombatTargetPosition('target_0', -3, 1, -5);
                if (!controls.resolvePlayerAttack()) throw new Error('Ataque do jogador não resolvido');
            });
            await page.waitForFunction(
                (actionId) => (window as any).__GAME_STATE__.lastImpactActionId !== actionId,
                previous
            );
        }
        expect(await page.evaluate(() => (window as any).__GAME_STATE__.lastImpactKind))
            .toBe('phonk-strong');

        await page.evaluate(() => (window as any).__GAME_TEST__.setEnemyHp('target_0', 0));
        await page.keyboard.press('Digit2');
        await page.waitForFunction(() => (window as any).__GAME_STATE__.station === 'samba');
        await page.evaluate(() =>
            (window as any).__GAME_TEST__.setCombatTargetPosition('target_1', -3, 1, -5)
        );
        await page.keyboard.down('ShiftLeft');
        await page.waitForFunction(() => (window as any).__GAME_STATE__.player.dashing);
        await page.keyboard.up('ShiftLeft');
        await page.waitForFunction(() => !(window as any).__GAME_STATE__.player.dashing);
        const previousImpact = await page.evaluate(() =>
            (window as any).__GAME_STATE__.lastImpactActionId
        );
        await page.evaluate(() => {
            const controls = (window as any).__GAME_TEST__;
            controls.setPlayerPosition(-3, 1, -6.5);
            controls.setCombatTargetPosition('target_1', -3, 1, -5);
            controls.prepareSambaCounter();
            if (!controls.resolvePlayerAttack()) throw new Error('Ataque do jogador não resolvido');
        });
        await page.waitForFunction(
            (previous) => (window as any).__GAME_STATE__.lastImpactActionId !== previous,
            previousImpact
        );

        const counter = await page.evaluate(() => (window as any).__GAME_STATE__);
        expect(counter.lastImpact).toMatchObject({
            kind: 'samba-counter',
            source: 'basic-attack',
            station: 'samba',
            targets: [{ damageAccepted: 15 }]
        });
        expect(counter.sambaCounterReady).toBe(false);
    });

    test('aggregates Forro multi-target and promotes a lethal action once', async ({ page }) => {
        await startGame(page, 'forro');
        await removeEncounterThreats(page, ['melee_0', 'melee_1']);
        await page.evaluate(() => {
            const controls = (window as any).__GAME_TEST__;
            controls.setPlayerPosition(0, 1, 4);
            controls.setEnemyPosition('melee_0', -0.35, 1, 5.5);
            controls.setEnemyPosition('melee_1', 0.35, 1, 5.5);
            if (!controls.resolvePlayerAttack()) throw new Error('Ataque do jogador não resolvido');
        });
        await page.waitForFunction(() => (window as any).__GAME_STATE__.lastImpactKind === 'forro-multi');

        const multi = await page.evaluate(() => (window as any).__GAME_STATE__.lastImpact);
        expect(multi).toMatchObject({
            kind: 'forro-multi',
            source: 'basic-attack',
            station: 'forro'
        });
        expect(multi.targets).toHaveLength(2);
        expect(new Set(multi.targets.map(() => multi.actionId)).size).toBe(1);

        await page.keyboard.press('Digit1');
        await page.waitForFunction(() => (window as any).__GAME_STATE__.station === 'phonk');
        const previousLethalImpact = await page.evaluate(() =>
            (window as any).__GAME_STATE__.lastImpactActionId
        );
        await page.evaluate(() => {
            const controls = (window as any).__GAME_TEST__;
            controls.setPlayerPosition(0, 1, 4);
            controls.setEnemyHp('melee_0', 5);
            controls.setEnemyPosition('melee_0', 0, 1, 5.5);
            controls.setEnemyHp('melee_1', 0);
            if (!controls.resolvePlayerAttack()) throw new Error('Ataque do jogador não resolvido');
        });
        await page.waitForFunction(
            (previous) => (window as any).__GAME_STATE__.lastImpactActionId !== previous,
            previousLethalImpact
        );
        const lethal = await page.evaluate(() => (window as any).__GAME_STATE__.lastImpact);
        expect(lethal).toMatchObject({
            kind: 'enemy-kill',
            source: 'basic-attack',
            targets: [{ targetId: 'melee_0', killed: true, damageAccepted: 5 }]
        });
    });

    test('records damage and Samba dodge but ignores global invulnerability', async ({ page }) => {
        await startGame(page, 'samba');
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
        await page.evaluate(() => {
            const controls = (window as any).__GAME_TEST__;
            controls.openSambaDodgeWindow();
            if (!controls.resolvePendingMeleeAttack('melee_0')) throw new Error('Melee sem windup');
        });
        await page.waitForFunction(() => (window as any).__GAME_STATE__.lastImpactKind === 'samba-dodge');
        expect(await page.evaluate(() => (window as any).__GAME_STATE__.player.hp)).toBe(100);

        await page.evaluate(() => {
            const controls = (window as any).__GAME_TEST__;
            controls.setEnemyPosition('melee_1', 0, 1, 5);
            controls.advanceEncounter(0);
            if (!controls.resolvePendingMeleeAttack('melee_1')) throw new Error('Melee sem windup');
        });
        await page.waitForFunction(() => (window as any).__GAME_STATE__.lastImpactKind === 'player-damaged');
        const accepted = await page.evaluate(() => (window as any).__GAME_STATE__);
        expect(accepted.player.hp).toBe(80);
        const acceptedActionId = accepted.lastImpactActionId;

        await page.evaluate(() => {
            const controls = (window as any).__GAME_TEST__;
            controls.advanceEncounter(0.8);
            controls.setEnemyPosition('melee_0', 0, 1, 5);
            controls.advanceEncounter(0);
            if (!controls.resolvePendingMeleeAttack('melee_0')) throw new Error('Melee sem windup');
        });
        expect(await page.evaluate(() => (window as any).__GAME_STATE__.lastImpactActionId))
            .toBe(acceptedActionId);
        expect(await page.evaluate(() => (window as any).__GAME_STATE__.player.hp)).toBe(80);
    });
});
