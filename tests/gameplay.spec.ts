import { test, expect } from '@playwright/test';

async function start(page: import('@playwright/test').Page, network = 'success') {
  await page.goto(`/?testClock=manual&seed=42&network=${network}`);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByLabel('Naval battle arena')).toBeVisible();
  await page.getByRole('button', { name: 'Set sail', exact: true }).click();
  await expect(page.getByLabel('Match status')).toHaveText('Running');
}

test('runs real keyboard input and freezes the clock on pause', async ({ page }) => {
  await start(page);
  await page.keyboard.down('w');
  await page.evaluate(() => window.__gameTest!.advance(1));
  await page.keyboard.up('w');
  expect(await page.evaluate(() => window.__gameTest!.snapshot().player.x)).toBeCloseTo(300, 2);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Pause the panic' })).toBeVisible();
  const elapsed = await page.evaluate(() => window.__gameTest!.snapshot().elapsed);
  await page.evaluate(() => window.__gameTest!.advance(10));
  expect(await page.evaluate(() => window.__gameTest!.snapshot().elapsed)).toBe(elapsed);
  await page.getByRole('button', { name: 'Resume voyage' }).click();
  await page.evaluate(() => window.__gameTest!.advance(0.1));
  expect(await page.evaluate(() => window.__gameTest!.snapshot().elapsed)).toBeCloseTo(
    elapsed + 0.1,
    3,
  );
});

test('fires seven projectiles through the actual keyboard controls', async ({ page }) => {
  await start(page);
  await page.keyboard.down('Space');
  await page.keyboard.down('q');
  await page.keyboard.down('e');
  await page.evaluate(() => window.__gameTest!.advance(1 / 60));
  expect(await page.evaluate(() => window.__gameTest!.snapshot().projectiles.length)).toBe(7);
  await page.keyboard.up('Space');
  await page.keyboard.up('q');
  await page.keyboard.up('e');
});

test('finishes a round, restores its result and creates a clean replay', async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.__gameTest!.advance(180));
  await expect(page.getByRole('button', { name: 'Play Again' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Last voyage' }).click();
  await expect(page.getByRole('button', { name: 'Play Again' })).toBeVisible();
  await page.getByRole('button', { name: 'Play Again' }).click();
  await page.getByRole('button', { name: 'Set sail', exact: true }).click();
  await expect(page.getByLabel('Match status')).toHaveText('Running');
  expect(await page.evaluate(() => window.__gameTest!.snapshot().player.hp)).toBe(100);
  expect(await page.evaluate(() => window.__gameTest!.snapshot().score)).toBe(0);
});

test('pauses on focus loss and clears held controls before resume', async ({ page }) => {
  await start(page);
  await page.keyboard.down('w');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByLabel('Match status')).toHaveText('Paused');
  await page.evaluate(() => window.__gameTest!.advance(10));
  expect(await page.evaluate(() => window.__gameTest!.snapshot().elapsed)).toBe(0);
  await page.getByRole('button', { name: 'Resume voyage' }).click();
  await page.evaluate(() => window.__gameTest!.advance(1));
  expect(await page.evaluate(() => window.__gameTest!.snapshot().player.x)).toBe(120);
  await page.keyboard.up('w');
});

test('does not rearm a held key from automatic repeat after a pause', async ({ page }) => {
  await start(page);
  await page.keyboard.down('w');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Resume voyage' }).click();
  await page.keyboard.down('w');
  await page.evaluate(() => window.__gameTest!.advance(1));
  expect(await page.evaluate(() => window.__gameTest!.snapshot().player.x)).toBe(120);
  await page.keyboard.up('w');
  await page.keyboard.down('w');
  await page.evaluate(() => window.__gameTest!.advance(0.5));
  expect(await page.evaluate(() => window.__gameTest!.snapshot().player.x)).toBeCloseTo(210, 2);
  await page.keyboard.up('w');
});

test('fires opposite broadsides with left and right mouse buttons while sailing', async ({
  page,
}) => {
  await start(page);
  const arena = await page.getByLabel('Naval battle arena').boundingBox();
  await page.mouse.move(arena!.x + arena!.width / 2, arena!.y + arena!.height / 2);
  await page.keyboard.down('w');
  await page.mouse.down({ button: 'left' });
  await page.evaluate(() => window.__gameTest!.advance(1 / 60));
  await page.mouse.up({ button: 'left' });
  const left = await page.evaluate(() => window.__gameTest!.snapshot());
  expect(left.projectiles.filter((shot) => shot.weapon === 'port')).toHaveLength(3);
  expect(left.player.x).toBeGreaterThan(120);
  await page.mouse.down({ button: 'right' });
  await page.evaluate(() => window.__gameTest!.advance(1 / 60));
  await page.mouse.up({ button: 'right' });
  expect(
    await page.evaluate(
      () =>
        window.__gameTest!.snapshot().projectiles.filter((shot) => shot.weapon === 'starboard')
          .length,
    ),
  ).toBe(3);
  await page.keyboard.up('w');
});

test('abandons repeated rounds without recording them or duplicating canvases', async ({
  page,
}) => {
  const registrations: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/matches')
      registrations.push(request.url());
  });
  await page.goto('/?testClock=manual&seed=42');
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.getByRole('button', { name: 'Set sail', exact: true }).click();
    await expect(page.getByLabel('Match status')).toHaveText('Running');
    await expect(page.getByLabel('Naval battle arena')).toHaveCount(1);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('button', { name: 'Main Menu' }).click();
    await expect(page.getByRole('button', { name: 'Last voyage' })).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        Object.keys(localStorage).filter((key) => key.startsWith('salt-and-trouble:outbox:')),
      ),
    ).toEqual([]);
    expect(registrations).toEqual([]);
  }
});

test('moves using a real touch pointer and releases it cleanly', async ({ page, context }) => {
  test.skip(!test.info().project.use.hasTouch, 'Real touch workflow runs on the mobile project.');
  await start(page);
  const bounds = await page.getByRole('button', { name: 'Move forward' }).boundingBox();
  expect(bounds).not.toBe(null);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: bounds!.x + bounds!.width / 2, y: bounds!.y + bounds!.height / 2, id: 1 }],
  });
  await page.evaluate(() => window.__gameTest!.advance(0.5));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await page.evaluate(() => window.__gameTest!.snapshot().player.x)).toBeCloseTo(210, 2);
  await page.evaluate(() => window.__gameTest!.advance(0.5));
  expect(await page.evaluate(() => window.__gameTest!.snapshot().player.x)).toBeCloseTo(210, 2);
});

test('shows asset failure and recovers through Retry loading', async ({ page, context }) => {
  await context.route('**/assets/png/default/tiles/tile_73.png', (route) => route.abort());
  await page.goto('/?testClock=manual&seed=42');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('could not load');
  await context.unroute('**/assets/png/default/tiles/tile_73.png');
  await page.getByRole('button', { name: 'Retry loading' }).click();
  await page.getByRole('button', { name: 'Set sail', exact: true }).click();
  await expect(page.getByLabel('Match status')).toHaveText('Running');
});

test('plays a complete round without unhandled page errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await start(page);
  await page.keyboard.down('w');
  await page.keyboard.down('Space');
  await page.evaluate(() => window.__gameTest!.advance(2));
  await page.keyboard.up('w');
  await page.keyboard.up('Space');
  await page.evaluate(() => window.__gameTest!.advance(180));
  await expect(page.getByRole('button', { name: 'Play Again' })).toBeVisible();
  await page.getByRole('button', { name: 'Main Menu' }).click();
  expect(errors).toEqual([]);
});

test('discloses failed persistence and retries without losing earlier reports', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key.startsWith('salt-and-trouble:outbox:') || key === 'salt-and-trouble:result:v1')
        throw new DOMException('Quota full', 'QuotaExceededError');
      originalSet.call(this, key, value);
    };
    Object.assign(window, {
      restoreStorage: () => {
        Storage.prototype.setItem = originalSet;
      },
    });
  });
  await start(page, 'offline');
  await page.evaluate(() => window.__gameTest!.advance(180));
  await expect(page.getByRole('alert')).toContainText('lost on refresh');
  await page.getByRole('button', { name: 'Play Again' }).click();
  await page.getByRole('button', { name: 'Set sail', exact: true }).click();
  await expect(page.getByLabel('Match status')).toHaveText('Running');
  await page.evaluate(() => window.__gameTest!.advance(180));
  await page.evaluate(() => (window as unknown as { restoreStorage: () => void }).restoreStorage());
  await page.getByRole('button', { name: 'Retry saving reports' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        Object.keys(localStorage).filter((key) => key.startsWith('salt-and-trouble:outbox:v2:'))
          .length,
    ),
  ).toBe(2);
});
