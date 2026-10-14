import { test, expect } from '@playwright/test';

test('holds the game clock until a keyboard-dismissed tutorial fades out', async ({ page }) => {
  await page.goto('/?testClock=manual&seed=42');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  const guide = page.getByRole('dialog', { name: 'A very short survival guide' });
  await expect(guide).toBeVisible();
  await expect(guide).toContainText('Left mouse');
  await page.evaluate(() => window.__gameTest!.advance(10));
  expect(await page.evaluate(() => window.__gameTest!.snapshot().elapsed)).toBe(0);
  await page.keyboard.press('w');
  await expect(guide).toHaveClass(/is-closing/);
  await expect(guide).toHaveCount(0);
  await expect(page.getByLabel('Match status')).toHaveText('Running');
  await page.evaluate(() => window.__gameTest!.advance(0.5));
  expect(await page.evaluate(() => window.__gameTest!.snapshot().player.x)).toBe(120);
});

test('accepts a right mouse button to dismiss without firing', async ({ page }) => {
  await page.goto('/?testClock=manual&seed=42');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'A very short survival guide' })).toBeVisible();
  await page.mouse.click(15, 15, { button: 'right' });
  await expect(page.getByRole('dialog', { name: 'A very short survival guide' })).toHaveCount(0);
  await page.evaluate(() => window.__gameTest!.advance(1 / 60));
  expect(await page.evaluate(() => window.__gameTest!.snapshot().projectiles)).toHaveLength(0);
});
