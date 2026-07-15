import { test, expect } from '@playwright/test';

test.describe('Game Foundation E2E', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        
        // Despacha a tela de "PRESSIONE QUALQUER TECLA"
        await page.keyboard.press('Enter');
        
        // Aguarda a injeção do hook usando casting para any
        await page.waitForFunction(() => (window as any).__GAME_STATE__ !== undefined);
    });

    test('1. Trocar de estação e confirmar estado', async ({ page }) => {
        await page.keyboard.press('Digit1');
        await expect(page.waitForFunction(() => (window as any).__GAME_STATE__.station === 'phonk')).resolves.toBeTruthy();

        await page.keyboard.press('Digit2');
        await expect(page.waitForFunction(() => (window as any).__GAME_STATE__.station === 'samba')).resolves.toBeTruthy();

        await page.keyboard.press('Digit3');
        await expect(page.waitForFunction(() => (window as any).__GAME_STATE__.station === 'forro')).resolves.toBeTruthy();
    });

    test('2. Aproximar de um alvo, atacar e confirmar redução de HP', async ({ page }) => {
        await page.keyboard.press('Digit3');
        await page.waitForFunction(() => (window as any).__GAME_STATE__.station === 'forro');

        // Caminha até o alvo
        await page.keyboard.down('KeyW');
        await page.waitForFunction(() => (window as any).__GAME_STATE__.player.z <= -3.0);
        await page.keyboard.up('KeyW');

        await page.keyboard.down('KeyA');
        await page.waitForFunction(() => (window as any).__GAME_STATE__.player.x <= -1.5);
        await page.keyboard.up('KeyA');

        // Mira para frente
        const viewport = page.viewportSize() || { width: 1280, height: 720 };
        await page.mouse.move(viewport.width / 2, viewport.height / 2 - 150);

        const initialHp = await page.evaluate(() => (window as any).__GAME_STATE__.targets[1].hp);
        expect(initialHp).toBeGreaterThan(0);

        // Ataca
        await page.mouse.down({ button: 'left' });
        await page.waitForTimeout(50);
        await page.mouse.up({ button: 'left' });

        await page.waitForFunction((hpBefore) => {
            return (window as any).__GAME_STATE__.targets[1].hp < hpBefore;
        }, initialHp);

        const afterFirstHitHp = await page.evaluate(() => (window as any).__GAME_STATE__.targets[1].hp);
        expect(afterFirstHitHp).toBeLessThan(initialHp);
    });

    test('3. Atacar o mesmo alvo consecutivamente e confirmar incremento de combo', async ({ page }) => {
        await page.keyboard.press('Digit3');
        await page.waitForFunction(() => (window as any).__GAME_STATE__.station === 'forro');

        // Caminha até o alvo (estado zerado pelo beforeEach)
        await page.keyboard.down('KeyW');
        await page.waitForFunction(() => (window as any).__GAME_STATE__.player.z <= -3.0);
        await page.keyboard.up('KeyW');

        await page.keyboard.down('KeyA');
        await page.waitForFunction(() => (window as any).__GAME_STATE__.player.x <= -1.5);
        await page.keyboard.up('KeyA');

        // Mira para frente
        const viewport = page.viewportSize() || { width: 1280, height: 720 };
        await page.mouse.move(viewport.width / 2, viewport.height / 2 - 150);

        // Primeiro Ataque (Inicia o combo)
        await page.mouse.down({ button: 'left' });
        await page.waitForTimeout(50);
        await page.mouse.up({ button: 'left' });

        // Aguarda o combo inicial ser registrado 
        await page.waitForFunction(() => (window as any).__GAME_STATE__.combo > 0);
        
        const initialCombo = await page.evaluate(() => (window as any).__GAME_STATE__.combo);
        expect(initialCombo).toBeGreaterThan(0);

        // Espera segura para garantir o tempo de recovery da arma
        await page.waitForTimeout(400);

        // Segundo Ataque Consecutivo
        await page.mouse.down({ button: 'left' });
        await page.waitForTimeout(50);
        await page.mouse.up({ button: 'left' });

        // Confirma o incremento
        await page.waitForFunction((comboBefore) => {
            return (window as any).__GAME_STATE__.combo > comboBefore;
        }, initialCombo);

        const finalCombo = await page.evaluate(() => (window as any).__GAME_STATE__.combo);
        expect(finalCombo).toBeGreaterThan(initialCombo);
    });
});