import { expect, test, type Page } from '@playwright/test';

async function startGame(page: Page, station: 'phonk' | 'samba' | 'forro' = 'forro') {
    await page.goto('/');
    await page.waitForFunction(() => Boolean((window as any).__GAME_STATE__ && (window as any).__GAME_TEST__));
    await page.evaluate(() => (window as any).__GAME_TEST__.startGame());
    await page.waitForFunction(() => (window as any).__GAME_STATE__.station === 'forro');
    const key = station === 'phonk' ? 'Digit1' : station === 'samba' ? 'Digit2' : 'Digit3';
    if (key !== 'Digit3') {
        await page.keyboard.press(key);
        await page.waitForFunction((expected) => (window as any).__GAME_STATE__.station === expected, station);
    }
}

async function killEnemies(page: Page, ids: string[]) {
    await page.evaluate((enemyIds) => {
        for (const id of enemyIds) (window as any).__GAME_TEST__.setEnemyHp(id, 0);
    }, ids);
}

async function dash(page: Page, movementKey?: string) {
    if (movementKey) await page.keyboard.down(movementKey);
    await page.keyboard.down('ShiftLeft');
    await page.waitForFunction(() => (window as any).__GAME_STATE__.player.dashing);
    await page.keyboard.up('ShiftLeft');
    if (movementKey) await page.keyboard.up(movementKey);
}

async function attack(page: Page) {
    const previousCommit = await page.evaluate(() => (window as any).__GAME_STATE__.attackCommitCount);
    await page.mouse.down({ button: 'left' });
    await page.waitForFunction(
        (before) => (window as any).__GAME_STATE__.attackCommitCount > before,
        previousCommit
    );
    await page.mouse.up({ button: 'left' });
}

test.describe('Core Combat - encontro permanente', () => {
    test.beforeEach(async ({ page }) => startGame(page));

    test('coordena dois melees, mantém ranged independente e aplica dano sem contato repetido', async ({ page }) => {
        const initial = await page.evaluate(() => (window as any).__GAME_STATE__);
        expect(initial.enemies.filter((enemy: any) => enemy.archetype === 'melee')).toHaveLength(2);
        expect(initial.enemies.filter((enemy: any) => enemy.archetype === 'ranged')).toHaveLength(1);
        expect(initial.player).toMatchObject({ hp: 100, maxHp: 100, alive: true, dead: false });

        await page.waitForFunction(() => (window as any).__GAME_STATE__.meleeAttackOwnerId !== null);
        const coordinated = await page.evaluate(() => (window as any).__GAME_STATE__);
        const attacking = coordinated.enemies.filter(
            (enemy: any) => enemy.archetype === 'melee' && ['windup', 'attack'].includes(enemy.state)
        );
        expect(attacking).toHaveLength(1);
        expect(attacking[0].id).toBe(coordinated.meleeAttackOwnerId);

        await killEnemies(page, ['melee_1', 'ranged_0']);
        await page.waitForFunction(() => (window as any).__GAME_STATE__.player.hp === 80);
        const hit = await page.evaluate(() => (window as any).__GAME_STATE__);
        expect(hit.player.invulnerable).toBe(true);
        expect(hit.enemies.find((enemy: any) => enemy.id === 'melee_0').attackResolutionCount).toBeGreaterThan(0);

        await page.evaluate(() => (window as any).__GAME_TEST__.damagePlayer(20));
        expect(await page.evaluate(() => (window as any).__GAME_STATE__.player.hp)).toBe(80);
    });

    test('altura evita melee e respawns individuais preservam os demais inimigos', async ({ page }) => {
        await killEnemies(page, ['melee_1', 'ranged_0']);
        await page.waitForFunction(() => {
            const melee = (window as any).__GAME_STATE__.enemies.find((enemy: any) => enemy.id === 'melee_0');
            return melee.state === 'windup';
        });

        await page.keyboard.down('Space');
        await page.waitForFunction(() => (window as any).__GAME_STATE__.player.airborne
            && (window as any).__GAME_STATE__.player.y > 2.25);
        await page.keyboard.up('Space');
        await page.waitForFunction(() => {
            const melee = (window as any).__GAME_STATE__.enemies.find((enemy: any) => enemy.id === 'melee_0');
            return melee.attackResolutionCount === 1;
        });
        expect(await page.evaluate(() => (window as any).__GAME_STATE__.player.hp)).toBe(100);

        const snapshot = await page.evaluate(() => {
            const controls = (window as any).__GAME_TEST__;
            controls.setEnemyHp('melee_0', 0);
            controls.advanceEncounter(0.3);
            controls.advanceEncounter(3);
            return controls.getEncounterSnapshot();
        });
        expect(snapshot.enemies.find((enemy: any) => enemy.id === 'melee_0')).toMatchObject({
            hp: 50, state: 'chase', x: -3, y: 1, z: -3
        });
        expect(snapshot.enemies.find((enemy: any) => enemy.id === 'melee_1').hp).toBe(50);
        expect(snapshot.enemies.find((enemy: any) => enemy.id === 'ranged_0').hp).toBe(40);
    });

    test('ranged telegrafa, dispara sem homing, causa 15 e permite evasão vertical', async ({ page }) => {
        await killEnemies(page, ['melee_0', 'melee_1']);
        await page.waitForFunction(() => {
            const ranged = (window as any).__GAME_STATE__.enemies.find((enemy: any) => enemy.archetype === 'ranged');
            return ranged.telegraphActive;
        });
        await page.waitForFunction(() => (window as any).__GAME_STATE__.projectileCount > 0);

        const projectile = await page.evaluate(() => (window as any).__GAME_STATE__.projectiles[0]);
        const hpBefore = await page.evaluate(() => (window as any).__GAME_STATE__.player.hp);
        await page.waitForFunction((id) => {
            const state = (window as any).__GAME_STATE__;
            const current = state.projectiles.find((item: any) => item.id === id);
            return current && Math.hypot(current.x - state.player.x, current.z - state.player.z) < 4;
        }, projectile.id);
        const moving = await page.evaluate(
            (id) => (window as any).__GAME_STATE__.projectiles.find((item: any) => item.id === id),
            projectile.id
        );
        expect(moving.direction).toEqual(projectile.direction);
        await page.waitForFunction((hp) => (window as any).__GAME_STATE__.player.hp === hp - 15, hpBefore);
        await page.waitForFunction(
            (id) => !(window as any).__GAME_STATE__.projectiles.some((item: any) => item.id === id),
            projectile.id
        );

        await page.evaluate(() => {
            const controls = (window as any).__GAME_TEST__;
            controls.resetEncounter();
            controls.setEnemyHp('melee_0', 0);
            controls.setEnemyHp('melee_1', 0);
            controls.setEnemyHp('ranged_0', 0);
            controls.setPlayerPosition(0, 1, 4);
        });
        await page.waitForFunction(() => (window as any).__GAME_STATE__.player.hp === 100);
        const verticalEvasion = await page.evaluate(() => {
            const controls = (window as any).__GAME_TEST__;
            controls.spawnProjectileAtPlayer(0, 1, 6);
            const id = controls.getEncounterSnapshot().projectiles[0].id;
            controls.setPlayerPosition(0, 4, 4);
            const hp = (window as any).__GAME_STATE__.player.hp;
            controls.advanceEncounter(1);
            return { id, hp };
        });
        expect(await page.evaluate(() => (window as any).__GAME_STATE__.player.hp)).toBe(verticalEvasion.hp);
        await page.evaluate(() => (window as any).__GAME_TEST__.advanceEncounter(4));
        await page.waitForFunction(
            (id) => !(window as any).__GAME_STATE__.projectiles.some((item: any) => item.id === id),
            verticalEvasion.id
        );
        expect(await page.evaluate(() => (window as any).__GAME_STATE__.player.hp)).toBe(verticalEvasion.hp);
    });
});

test.describe('Core Combat - estações permanentes', () => {
    test('Samba abre counter no dash, mas slow motion e esquiva exigem ameaça real', async ({ page }) => {
        await startGame(page, 'samba');
        await killEnemies(page, ['ranged_0']);
        await dash(page);
        const dashOnly = await page.evaluate(() => (window as any).__GAME_STATE__);
        expect(dashOnly.sambaCounterReady).toBe(true);
        expect(dashOnly.slowMotionActive).toBe(false);

        await page.evaluate(() => {
            const controls = (window as any).__GAME_TEST__;
            controls.resetEncounter();
            controls.setPlayerPosition(0, 1, 4);
            controls.setEnemyPosition('melee_0', 0, 1, 5);
            controls.setEnemyPosition('melee_1', 12, 1, 12);
            controls.setEnemyHp('ranged_0', 0);
        });
        await page.waitForFunction(() => {
            const enemy = (window as any).__GAME_STATE__.enemies.find((item: any) => item.id === 'melee_0');
            return enemy.state === 'windup';
        });
        const hpBefore = await page.evaluate(() => (window as any).__GAME_STATE__.player.hp);
        await page.evaluate(() => {
            const state = (window as any).__GAME_STATE__;
            const controls = (window as any).__GAME_TEST__;
            controls.setEnemyPosition('melee_0', state.player.x, state.player.y, state.player.z + 1);
            controls.openSambaDodgeWindow();
            if (!controls.resolvePendingMeleeAttack('melee_0')) throw new Error('Melee sem windup');
        });
        await page.waitForFunction(() => (window as any).__GAME_STATE__.slowMotionActive);
        const dodged = await page.evaluate(() => (window as any).__GAME_STATE__);
        expect(dodged.player.hp).toBe(hpBefore);
        expect(dodged.timeScale).toBe(0.5);

        await killEnemies(page, ['melee_0']);
        await page.evaluate(() => {
            const player = (window as any).__GAME_STATE__.player;
            (window as any).__GAME_TEST__.setEnemyPosition('melee_1', player.x, 1, player.z + 1.5);
        });
        const targetHp = await page.evaluate(() =>
            (window as any).__GAME_STATE__.enemies.find((item: any) => item.id === 'melee_1').hp);
        await attack(page);
        const countered = await page.evaluate(() => (window as any).__GAME_STATE__);
        expect(countered.enemies.find((item: any) => item.id === 'melee_1').hp).toBe(targetHp - 15);
        expect(countered.sambaCounterReady).toBe(false);
    });

    test('Forró concede +2 uma vez por dash e Phonk preserva combo e dash-cancel', async ({ page }) => {
        await startGame(page, 'forro');
        await killEnemies(page, ['ranged_0']);
        await page.evaluate(() => {
            const controls = (window as any).__GAME_TEST__;
            controls.setEnergy(0);
            controls.setPlayerPosition(0, 1, 4);
            controls.setEnemyPosition('melee_0', -0.25, 1, 5.2);
            controls.setEnemyPosition('melee_1', 0.25, 1, 5.2);
        });
        await dash(page);
        await page.waitForFunction(() => {
            const state = (window as any).__GAME_STATE__;
            return state.energy === 2 && state.forroDashHitCount === 2;
        });
        const forro = await page.evaluate(() => (window as any).__GAME_STATE__);
        expect(forro.forroDashHitCount).toBe(2);
        expect(forro.forroDashEnergyGranted).toBe(true);

        await page.reload();
        await page.waitForFunction(() => Boolean((window as any).__GAME_STATE__ && (window as any).__GAME_TEST__));
        await page.evaluate(() => (window as any).__GAME_TEST__.startGame());
        await page.waitForFunction(() => (window as any).__GAME_STATE__?.station === 'forro');
        await page.keyboard.press('Digit1');
        await page.waitForFunction(() => (window as any).__GAME_STATE__.station === 'phonk');
        await killEnemies(page, ['melee_1', 'ranged_0']);
        await page.evaluate(() => {
            const controls = (window as any).__GAME_TEST__;
            controls.setPlayerPosition(0, 1, 4);
            controls.setEnemyPosition('melee_0', 0, 1, 5.5);
        });
        await attack(page);
        expect(await page.evaluate(() => (window as any).__GAME_STATE__.combo)).toBeGreaterThan(0);
        await page.waitForFunction(() => (window as any).__GAME_STATE__.player.attackState === 'idle');
        await page.mouse.down({ button: 'left' });
        await page.waitForFunction(() => (window as any).__GAME_STATE__.player.attackState === 'windup');
        await dash(page);
        await page.mouse.up({ button: 'left' });
        const cancelled = await page.evaluate(() => (window as any).__GAME_STATE__.player);
        expect(cancelled.dashing).toBe(true);
        expect(cancelled.attackState).toBe('idle');
    });

    test('soft aim seleciona candidato válido somente no commit e funciona no double jump', async ({ page }) => {
        await startGame(page, 'phonk');
        await killEnemies(page, ['melee_1', 'ranged_0']);
        await page.evaluate(() => {
            const controls = (window as any).__GAME_TEST__;
            controls.setPlayerPosition(4, 1, 4);
            controls.setEnemyPosition('melee_0', 4.5, 1, 6.8);
        });
        expect(await page.evaluate(() => (window as any).__GAME_STATE__.lastCommittedAimSource)).toBe('none');

        for (let jump = 1; jump <= 2; jump++) {
            await page.keyboard.down('Space');
            await page.waitForFunction(
                (expected) => (window as any).__GAME_STATE__.player.jumpCount === expected,
                jump
            );
            await page.keyboard.up('Space');
            await page.waitForFunction(() => (window as any).__GAME_STATE__.player.jumpInputReady);
        }
        const hpBefore = await page.evaluate(() =>
            (window as any).__GAME_STATE__.enemies.find((item: any) => item.id === 'melee_0').hp);
        await attack(page);
        const aimed = await page.evaluate(() => (window as any).__GAME_STATE__);
        expect(aimed.player.airborne).toBe(true);
        expect(aimed.enemies.find((item: any) => item.id === 'melee_0').hp).toBeLessThan(hpBefore);
        expect(aimed.lastCommittedAimSource).toBe('assisted');
        expect(aimed.lastCommittedAimTargetId).toBe('melee_0');
    });
});

test.describe('Core Combat - transformação e lifecycle permanentes', () => {
    test('transformação bloqueia estação, mantém aura máxima e encerra pela energia', async ({ page }) => {
        await startGame(page, 'forro');
        await page.evaluate(() => (window as any).__GAME_TEST__.setEnergy(100));
        await page.waitForFunction(() => (window as any).__GAME_STATE__.energy === 100);
        await page.keyboard.press('KeyR');
        await page.waitForFunction(() => (window as any).__GAME_STATE__.transformed);
        expect(await page.evaluate(() => (window as any).__GAME_STATE__.auraIntensity)).toBe(1);

        await page.keyboard.press('Digit1');
        await page.mouse.wheel(0, 100);
        expect(await page.evaluate(() => (window as any).__GAME_STATE__.station)).toBe('forro');

        await page.evaluate(() => (window as any).__GAME_TEST__.advanceTransformation(15));
        await page.waitForFunction(() => !(window as any).__GAME_STATE__.transformed);
        const ended = await page.evaluate(() => (window as any).__GAME_STATE__);
        expect(ended).toMatchObject({
            station: 'forro',
            energy: 0,
            transformed: false,
            auraIntensity: 0,
            activeTrackId: 'forro'
        });
    });

    test('morte congela, revive reseta e cinco ciclos não duplicam encontro nem listener', async ({ page }) => {
        await startGame(page, 'samba');
        await page.evaluate(() => {
            const controls = (window as any).__GAME_TEST__;
            controls.setEnergy(100);
            controls.spawnProjectileAtPlayer(10, 10, 10);
        });
        await page.keyboard.press('KeyR');
        await page.waitForFunction(() => (window as any).__GAME_STATE__.transformed);
        await page.evaluate(() => (window as any).__GAME_TEST__.damagePlayer(100));
        await page.waitForFunction(() => (window as any).__GAME_STATE__.encounterStatus === 'awaiting-revive');

        const dead = await page.evaluate(() => (window as any).__GAME_STATE__);
        expect(dead.inputBlocked).toBe(true);
        expect(dead.encounterFrozen).toBe(true);
        expect(dead.deathOverlayVisible).toBe(true);
        expect(dead.player.dead).toBe(true);
        expect(dead.station).toBe('samba');
        await page.evaluate(() => (window as any).__GAME_TEST__.advanceEncounter(10));
        expect(await page.evaluate(() => (window as any).__GAME_STATE__.player.dead)).toBe(true);

        for (let cycle = 1; cycle <= 5; cycle++) {
            await page.getByRole('button', { name: 'Reviver' }).click();
            await page.waitForFunction(() => (window as any).__GAME_STATE__.encounterStatus === 'active');
            const revived = await page.evaluate(() => (window as any).__GAME_STATE__);
            expect(revived.reviveCount).toBe(cycle);
            expect(revived.inputBlocked).toBe(false);
            expect(revived.player).toMatchObject({ hp: 100, maxHp: 100, alive: true, dead: false });
            expect(revived).toMatchObject({
                station: 'samba',
                combo: 0,
                energy: 0,
                transformed: false,
                projectileCount: 0,
                meleeAttackOwnerId: null
            });
            expect(revived.enemies).toHaveLength(3);
            expect(new Set(revived.enemies.map((enemy: any) => enemy.id)).size).toBe(3);
            await expect(page.locator('#death-overlay')).toHaveCount(1);
            await expect(page.locator('#btn-revive')).toHaveCount(1);
            if (cycle < 5) {
                await page.evaluate(() => (window as any).__GAME_TEST__.damagePlayer(100));
                await page.waitForFunction(() =>
                    (window as any).__GAME_STATE__.encounterStatus === 'awaiting-revive'
                );
            }
        }
    });

    test('dez respawns e múltiplas transformações mantêm contagens e identificadores estáveis', async ({ page }) => {
        await startGame(page, 'forro');
        for (let cycle = 0; cycle < 10; cycle++) {
            const id = cycle % 2 === 0 ? 'melee_0' : 'ranged_0';
            const snapshot = await page.evaluate((enemyId) => {
                const controls = (window as any).__GAME_TEST__;
                controls.setEnemyHp(enemyId, 0);
                controls.advanceEncounter(0.3);
                controls.advanceEncounter(3);
                return controls.getEncounterSnapshot();
            }, id);
            expect(snapshot.enemies).toHaveLength(3);
            expect(new Set(snapshot.enemies.map((enemy: any) => enemy.id)).size).toBe(3);
            expect(snapshot.enemies.find((enemy: any) => enemy.id === id).hp).toBe(id === 'ranged_0' ? 40 : 50);
        }

        for (const station of [
            { key: 'Digit1', id: 'phonk' },
            { key: 'Digit2', id: 'samba' },
            { key: 'Digit3', id: 'forro' }
        ]) {
            await page.keyboard.press(station.key);
            await page.waitForFunction((expected) => (window as any).__GAME_STATE__.station === expected, station.id);
            await page.evaluate(() => (window as any).__GAME_TEST__.setEnergy(100));
            await page.keyboard.press('KeyR');
            await page.waitForFunction(() => (window as any).__GAME_STATE__.transformed);
            await page.evaluate(() => (window as any).__GAME_TEST__.advanceTransformation(15));
            await page.waitForFunction(() => !(window as any).__GAME_STATE__.transformed);
            expect(await page.evaluate(() => (window as any).__GAME_STATE__.projectileCount)).toBeGreaterThanOrEqual(0);
        }
        const stable = await page.evaluate(() => (window as any).__GAME_STATE__);
        expect(stable.enemies).toHaveLength(3);
        expect(new Set(stable.enemies.map((enemy: any) => enemy.id)).size).toBe(3);
        expect(stable.activeTrackId).toBe('forro');
    });
});
