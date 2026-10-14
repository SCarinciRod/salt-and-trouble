import { test, expect } from '@playwright/test';

test('menu visual reference', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole('heading', { name: 'Salt & Trouble' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Ranking', exact: true })).toBeVisible();
  await page.screenshot({ path: `Temp/menu-${test.info().project.name}.png`, fullPage: true });
  await expect(page).toHaveScreenshot('menu.png', { fullPage: true });
});

test('stable arena visual reference', async ({ page }) => {
  await page.goto('/?testClock=manual&seed=42');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Set sail', exact: true }).click();
  await expect(page.getByLabel('Match status')).toHaveText('Running');
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.__gameTest!.advance(3));
  await page.screenshot({ path: `Temp/arena-${test.info().project.name}.png`, fullPage: true });
  await expect(page).toHaveScreenshot('arena.png', { fullPage: true });
});

test('result visual reference', async ({ page }) => {
  await page.goto('/?testClock=manual&seed=42');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Set sail', exact: true }).click();
  await expect(page.getByLabel('Match status')).toHaveText('Running');
  await page.evaluate(() => window.__gameTest!.advance(180));
  await expect(page.getByRole('button', { name: 'Play Again' })).toBeVisible();
  await expect(page.getByLabel('Match registration')).toContainText('Saved');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `Temp/result-${test.info().project.name}.png`, fullPage: true });
  await expect(page).toHaveScreenshot('result.png', { fullPage: true });
});

test('tutorial visual reference', async ({ page }) => {
  await page.goto('/?testClock=manual&seed=42');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'A very short survival guide' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `Temp/tutorial-${test.info().project.name}.png`, fullPage: true });
  await expect(page).toHaveScreenshot('tutorial.png', { fullPage: true });
});
