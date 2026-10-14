import { test, expect } from '@playwright/test';

test('saves valid options across a refresh', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await page.getByLabel('Game session time').fill('90');
  await page.getByLabel('Enemy spawn time').fill('2');
  await page.getByRole('button', { name: 'Save options' }).click();
  await expect(page.getByRole('dialog', { name: 'Options' }).getByRole('status')).toContainText(
    'saved',
  );
  await page.reload();
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await expect(page.getByLabel('Game session time')).toHaveValue('90');
  await expect(page.getByLabel('Enemy spawn time')).toHaveValue('2');
});

test('rejects invalid options and keeps the previous saved values', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await page.getByLabel('Game session time').fill('59');
  await page.getByLabel('Enemy spawn time').fill('0');
  await page.getByRole('button', { name: 'Save options' }).click();
  await expect(page.getByRole('alert')).toContainText('60 and 180');
  await expect(page.getByRole('alert')).toContainText('0.5 and 15');
  await page.reload();
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await expect(page.getByLabel('Game session time')).toHaveValue('120');
});

test('discards corrupt stored options without breaking the menu', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('salt-and-trouble:options:v1', 'broken');
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Salt & Trouble' })).toBeVisible();
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await expect(page.getByLabel('Game session time')).toHaveValue('120');
});
