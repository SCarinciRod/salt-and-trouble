import { test, expect, type Page } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

test('serves the exact validated build entry, worker and main script', async ({ request }) => {
  const entry = await readFile('dist/index.html', 'utf8');
  const script = entry.match(/src="([^"]+\.js)"/)![1]!;
  for (const path of ['/index.html', '/mockServiceWorker.js', script]) {
    const remote = await request.get(path);
    expect(remote.ok()).toBe(true);
    const local = await readFile(`dist${path}`);
    const hash = (content: Uint8Array) => createHash('sha256').update(content).digest('hex');
    expect(hash(await remote.body()), path).toBe(hash(local));
  }
});

async function setOptions(page: Page) {
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await page.getByLabel('Game session time').fill('60');
  await page.getByLabel('Enemy spawn time').fill('0.5');
  await page.getByRole('button', { name: 'Save options' }).click();
  await page.getByLabel('Close options').click();
}

test('persists options and starts actual combat after refreshing the optimized URL', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('table', { name: 'Ranking', exact: true })).toBeVisible();
  if (process.env.PUBLIC_GAME_URL) {
    await mkdir('reports/deployment', { recursive: true });
    await page.screenshot({
      path: `reports/deployment/public-menu-${testInfo.project.name}.png`,
      fullPage: true,
    });
  }
  await setOptions(page);
  await page.reload();
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await expect(page.getByLabel('Game session time')).toHaveValue('60');
  await expect(page.getByLabel('Enemy spawn time')).toHaveValue('0.5');
  await page.getByLabel('Close options').click();
  const worker = await page.request.get('/mockServiceWorker.js');
  expect(worker.ok()).toBe(true);
  expect(worker.headers()['content-type']).toMatch(/javascript/);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Set sail', exact: true }).click();
  await expect(page.getByLabel('Naval battle arena')).toBeVisible();
  await page.keyboard.down('w');
  await page.keyboard.down('Space');
  await page.waitForTimeout(500);
  await page.keyboard.up('w');
  await page.keyboard.up('Space');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByLabel('Match status')).toHaveText('Paused');
  await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
  expect(errors).toEqual([]);
});

test('recovers a real completed match after refresh and API recovery in production', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?network=offline');
  await setOptions(page);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Set sail', exact: true }).click();
  expect(await page.evaluate(() => window.__gameTest)).toBeUndefined();
  await expect(page.getByRole('button', { name: 'Play Again' })).toBeVisible({ timeout: 65_000 });
  await expect(page.getByLabel('Match registration')).toContainText('Pending');
  const pending = await page.evaluate(() =>
    Object.keys(localStorage).filter((key) => key.startsWith('salt-and-trouble:outbox:v2:')),
  );
  expect(pending).toHaveLength(1);
  await page.reload();
  await page.getByRole('button', { name: 'Last voyage' }).click();
  await expect(page.getByLabel('Match registration')).toContainText('Pending');
  await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
  await page.getByText('Network conditions', { exact: true }).click();
  await page.getByLabel('Network scenario').selectOption('success');
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage).filter((key) => key.startsWith('salt-and-trouble:outbox:v2:')),
      ),
    )
    .toEqual([]);
  await page.getByRole('tab', { name: 'Match History', exact: true }).click();
  await expect(
    page.getByRole('table', { name: 'Match History', exact: true }).getByRole('row'),
  ).toHaveCount(2);
  await page.getByRole('tab', { name: 'Ranking', exact: true }).click();
  await expect(
    page.getByRole('table', { name: 'Ranking', exact: true }).getByRole('row'),
  ).toHaveCount(2);
  expect(errors).toEqual([]);
});
