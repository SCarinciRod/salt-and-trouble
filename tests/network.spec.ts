import { test, expect, type Page } from '@playwright/test';

async function finish(page: Page, play = 'Play') {
  await page.getByRole('button', { name: play, exact: true }).click();
  await page.getByRole('button', { name: 'Set sail', exact: true }).click();
  await expect(page.getByLabel('Match status')).toHaveText('Running');
  await page.evaluate(() => window.__gameTest!.advance(180));
  await expect(page.getByRole('button', { name: 'Play Again' })).toBeVisible();
}
async function scenario(page: Page, value: string) {
  const select = page.getByLabel('Network scenario');
  if (!(await select.isVisible()))
    await page.getByText('Network conditions', { exact: true }).click();
  await select.selectOption(value);
}

test('paginates history and navigates tabs with the keyboard', async ({ page }) => {
  await page.goto('/?network=multiple-pages');
  const ranking = page.getByRole('tab', { name: 'Ranking', exact: true });
  await ranking.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Match History', exact: true })).toBeFocused();
  await expect(
    page.getByRole('table', { name: 'Match History', exact: true }).getByRole('row'),
  ).toHaveCount(6);
  await page.screenshot({ path: `Temp/history-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Next history page' }).click();
  await expect(page.getByLabel('History page', { exact: true })).toHaveText('Page 2 of 3');
  await page.getByRole('button', { name: 'Next history page' }).click();
  await expect(
    page.getByRole('table', { name: 'Match History', exact: true }).getByRole('row'),
  ).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Next history page' })).toBeDisabled();
  await page.getByRole('tab', { name: 'Match History', exact: true }).focus();
  await page.keyboard.press('Home');
  await expect(ranking).toBeFocused();
  await expect(ranking).toHaveAttribute('aria-selected', 'true');
});

test('isolates list failures and recovers through scenario selection', async ({ page }) => {
  await page.goto('/?network=ranking-error');
  await expect(page.getByRole('alert')).toContainText('could not load');
  await page.getByRole('tab', { name: 'Match History', exact: true }).click();
  await expect(page.getByText('No voyages logged yet.')).toBeVisible();
  await scenario(page, 'history-error');
  await expect(page.getByText('Refresh failed.', { exact: false })).toBeVisible();
  await page.getByRole('tab', { name: 'Ranking', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Ranking', exact: true })).toContainText(
    'Admiral Probably',
  );
  await scenario(page, 'success');
  await page.getByRole('tab', { name: 'Match History', exact: true }).click();
  await expect(page.getByText('No voyages logged yet.')).toBeVisible();
});

for (const mode of ['http-400', 'http-500', 'timeout'] as const) {
  test(`keeps Play and Options usable during ${mode}`, async ({ page }) => {
    let rankingRequests = 0;
    page.on('request', (request) => {
      if (request.url().includes('/api/ranking?')) rankingRequests++;
    });
    await page.goto(`/?network=${mode}&testClock=manual&seed=42`);
    await expect(page.getByRole('alert')).toContainText('could not load');
    expect(rankingRequests).toBe(mode === 'http-400' ? 1 : 2);
    await page.getByRole('button', { name: 'Options', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Options' })).toBeVisible();
    await page.getByRole('button', { name: 'Close options' }).click();
    await finish(page);
    await expect(page.getByLabel('Match registration')).toContainText('did not confirm');
    await expect(page.getByRole('button', { name: 'Play Again' })).toBeEnabled();
    await page.getByRole('button', { name: 'Main Menu' }).click();
    await scenario(page, 'success');
    await expect(page.getByText('1 pending incident report.', { exact: false })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Match History', exact: true }).click();
    await expect(
      page.getByRole('table', { name: 'Match History', exact: true }).getByRole('row'),
    ).toHaveCount(2);
  });
}

test('keeps two pending voyages through refresh and retries each exactly once', async ({
  page,
}) => {
  await page.goto('/?network=offline&testClock=manual&seed=42');
  await finish(page);
  await expect(page.getByLabel('Match registration')).toContainText('did not confirm');
  await finish(page, 'Play Again');
  await expect(page.getByLabel('Match registration')).toContainText('did not confirm');
  await page.reload();
  await expect(page.getByText('2 pending incident reports.', { exact: false })).toBeVisible();
  await scenario(page, 'empty');
  await page.getByRole('tab', { name: 'Match History', exact: true }).click();
  const rows = page.getByRole('table', { name: 'Match History', exact: true }).getByRole('row');
  await expect(rows).toHaveCount(3);
  await page.getByRole('tab', { name: 'Ranking', exact: true }).click();
  await expect(
    page.getByRole('table', { name: 'Ranking', exact: true }).getByRole('row'),
  ).toHaveCount(3);
  await page.reload();
  await page.getByRole('tab', { name: 'Match History', exact: true }).click();
  await expect(rows).toHaveCount(3);
  expect(
    await page.evaluate(
      () =>
        Object.keys(localStorage).filter((key) => key.startsWith('salt-and-trouble:outbox:v2:'))
          .length,
    ),
  ).toBe(0);
});

test('uses new configuration filters while an older response is still in flight', async ({
  page,
}) => {
  const requested = page.waitForRequest((request) => request.url().includes('/api/ranking?'));
  await page.goto('/?network=out-of-order');
  await requested;
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await page.getByLabel('Game session time', { exact: false }).fill('60');
  await page.getByRole('button', { name: 'Save options' }).click();
  await page.getByRole('button', { name: 'Close options' }).click();
  await expect(page.getByText('No captains on the board yet.')).toBeVisible();
  await expect(page.getByText('Comparable voyages', { exact: false })).toContainText('60s session');
  // Allow the deliberately delayed older request to finish; it must not replace this view.
  await page.waitForTimeout(1100);
  await expect(page.getByText('No captains on the board yet.')).toBeVisible();
  await expect(page.getByRole('table', { name: 'Ranking', exact: true })).toHaveCount(0);
});

test('shows slow loading and variable latency without losing pagination', async ({ page }) => {
  await page.goto('/?network=slow');
  await expect(page.getByText('Fetching the captain’s paperwork…')).toBeVisible();
  await expect(page.getByRole('table', { name: 'Ranking', exact: true })).toBeVisible();
  await scenario(page, 'variable-latency');
  await page.getByRole('button', { name: 'Next ranking page' }).click();
  await expect(page.getByLabel('Ranking page', { exact: true })).toHaveText('Page 2 of 3');
  await scenario(page, 'empty');
  await expect(page.getByText('No captains on the board yet.')).toBeVisible();
});

test('handles worker startup failure and retries without blocking the game', async ({ page }) => {
  await page.addInitScript(() => {
    const register = navigator.serviceWorker.register.bind(navigator.serviceWorker);
    navigator.serviceWorker.register = () => Promise.reject(new Error('Worker unavailable'));
    Object.assign(window, {
      restoreWorker: () => {
        navigator.serviceWorker.register = register;
      },
    });
  });
  await page.goto('/?testClock=manual&seed=42');
  await expect(
    page.getByText('The demo data service could not start.', { exact: false }),
  ).toBeVisible();
  await finish(page);
  await expect(page.getByLabel('Match registration')).toContainText('Pending');
  await page.getByRole('button', { name: 'Main Menu' }).click();
  await page.evaluate(() => (window as unknown as { restoreWorker: () => void }).restoreWorker());
  await page.getByRole('button', { name: 'Retry data service' }).click();
  await page.getByRole('tab', { name: 'Match History', exact: true }).click();
  await expect(
    page.getByRole('table', { name: 'Match History', exact: true }).getByRole('row'),
  ).toHaveCount(2);
});

test('refreshing an active match never submits an abandoned report', async ({ page }) => {
  await page.goto('/?network=empty&testClock=manual&seed=42');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Set sail', exact: true }).click();
  await expect(page.getByLabel('Match status')).toHaveText('Running');
  await page.evaluate(() => window.__gameTest!.advance(3));
  await page.reload();
  await expect(page.getByText('No captains on the board yet.')).toBeVisible();
  await page.getByRole('tab', { name: 'Match History', exact: true }).click();
  await expect(page.getByText('No voyages logged yet.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Last voyage' })).toHaveCount(0);
});

test('resets demo reports while retaining options and player identity', async ({ page }) => {
  await page.goto('/?network=empty&testClock=manual&seed=42');
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await page.getByLabel('Game session time', { exact: false }).fill('60');
  await page.getByRole('button', { name: 'Save options' }).click();
  await page.getByRole('button', { name: 'Close options' }).click();
  const captain = await page.evaluate(() => localStorage.getItem('salt-and-trouble:player:v1'));
  await finish(page);
  await expect(page.getByLabel('Match registration')).toContainText('Saved');
  await page.getByRole('button', { name: 'Main Menu' }).click();
  await page.getByText('Network conditions', { exact: true }).click();
  await page.getByRole('button', { name: 'Reset demo records' }).click();
  await expect(page.getByRole('button', { name: 'Last voyage' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Match History', exact: true }).click();
  await expect(page.getByText('No voyages logged yet.')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('salt-and-trouble:player:v1'))).toBe(
    captain,
  );
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await expect(page.getByLabel('Game session time', { exact: false })).toHaveValue('60');
});

test('retries a worker startup that never settles using a fresh document', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('worker-hung-once')) {
      sessionStorage.setItem('worker-hung-once', 'yes');
      navigator.serviceWorker.register = () => new Promise(() => {});
    }
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  await expect(page.getByText('Retrying will reload this page.', { exact: false })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('button', { name: 'Retry data service' }).click();
  await expect(page.getByRole('table', { name: 'Ranking', exact: true })).toBeVisible();
});
