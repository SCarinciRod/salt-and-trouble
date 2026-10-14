import { test, expect } from '@playwright/test';

test('shows both required tabs and paginates the default ranking', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Ranking', exact: true }).click();
  const table = page.getByRole('table', { name: 'Ranking', exact: true });
  await expect(table.getByRole('row')).toHaveCount(6);
  await expect(table).toContainText('Admiral Probably');
  await page.getByRole('button', { name: 'Next ranking page' }).click();
  await expect(page.getByLabel('Ranking page', { exact: true })).toHaveText('Page 2 of 3');
  await expect(table.getByRole('row')).toHaveCount(6);
  await page.getByRole('tab', { name: 'Match History', exact: true }).click();
  await expect(page.getByText('No voyages logged yet.')).toBeVisible();
});

test('registers a completed match and updates both tabs after refresh', async ({ page }) => {
  await page.goto('/?network=empty&testClock=manual&seed=42');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Set sail', exact: true }).click();
  await expect(page.getByLabel('Match status')).toHaveText('Running');
  await page.evaluate(() => window.__gameTest!.advance(180));
  await expect(page.getByLabel('Match registration')).toContainText('Saved');
  await page.getByRole('button', { name: 'Main Menu' }).click();
  await expect(page.getByRole('table', { name: 'Ranking', exact: true })).toContainText(
    'Captain Bad Idea',
  );
  await page.getByRole('tab', { name: 'Match History', exact: true }).click();
  await expect(
    page.getByRole('table', { name: 'Match History', exact: true }).getByRole('row'),
  ).toHaveCount(2);
  await page.reload();
  await page.getByRole('tab', { name: 'Match History', exact: true }).click();
  await expect(
    page.getByRole('table', { name: 'Match History', exact: true }).getByRole('row'),
  ).toHaveCount(2);
});

test('recovers a timeout after recording without duplicating the match', async ({ page }) => {
  await page.goto('/?network=write-timeout&testClock=manual&seed=42');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Set sail', exact: true }).click();
  await expect(page.getByLabel('Match status')).toHaveText('Running');
  await page.evaluate(() => window.__gameTest!.advance(180));
  await expect(page.getByLabel('Match registration')).toContainText('Pending');
  await expect(page.getByLabel('Match registration')).toContainText('did not confirm');
  await page.getByRole('button', { name: 'Retry registration' }).click();
  await expect(page.getByLabel('Match registration')).toContainText('Saved');
  await page.getByRole('button', { name: 'Main Menu' }).click();
  await page.getByRole('tab', { name: 'Match History', exact: true }).click();
  await expect(
    page.getByRole('table', { name: 'Match History', exact: true }).getByRole('row'),
  ).toHaveCount(2);
});
