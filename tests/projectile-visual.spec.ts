import { test, expect } from '@playwright/test';

test('cannonballs and smoke visual reference', async ({ page }) => {
  await page.goto('/?testClock=manual&seed=42');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Set sail', exact: true }).click();
  await expect(page.getByLabel('Match status')).toHaveText('Running');
  await page.keyboard.down('Space');
  await page.keyboard.down('q');
  await page.keyboard.down('e');
  await page.evaluate(() => window.__gameTest!.advance(1 / 60));
  await page.keyboard.up('Space');
  await page.keyboard.up('q');
  await page.keyboard.up('e');
  await page.evaluate(() => window.__gameTest!.advance(0.2));
  await page.evaluate(() => document.fonts.ready);
  const arena = page.getByLabel('Naval battle arena');
  await arena.screenshot({ path: `Temp/cannonballs-${test.info().project.name}.png` });
  await expect(arena).toHaveScreenshot('cannonballs.png');
});
