import { test, expect } from '@playwright/test';
import { advance, aimAt, begin, moveFor, snapshot, turnTo } from './combatHelpers';

test('turns both ways at the configured rate using keyboard input', async ({ page }) => {
  await begin(page);
  await page.keyboard.down('d');
  await advance(page, 0.5);
  await page.keyboard.up('d');
  expect((await snapshot(page)).player.angle).toBeCloseTo(1.1, 5);
  await page.keyboard.down('a');
  await advance(page, 0.5);
  await page.keyboard.up('a');
  expect((await snapshot(page)).player.angle).toBeCloseTo(0, 5);
  expect((await snapshot(page)).player.x).toBe(120);
});

test('clamps all four arena boundaries while keeping the ship inside', async ({ page }) => {
  await begin(page);
  await turnTo(page, -Math.PI / 2 - 0.04);
  await moveFor(page, 2);
  expect((await snapshot(page)).player.y).toBe(32);
  await turnTo(page, Math.PI + 0.04);
  await moveFor(page, 2);
  expect((await snapshot(page)).player.x).toBe(32);
  await turnTo(page, -0.04);
  await moveFor(page, 6);
  expect((await snapshot(page)).player.x).toBe(992);
  await turnTo(page, Math.PI / 2 - 0.04);
  await moveFor(page, 4);
  expect((await snapshot(page)).player.y).toBe(608);
  expect((await snapshot(page)).player.x).toBeGreaterThan(980);
  await turnTo(page, 0);
  await moveFor(page, 0.2);
  expect((await snapshot(page)).player.x).toBe(992);
});

test('blocks sailing and cannonballs at an island', async ({ page }) => {
  await begin(page);
  await turnTo(page, Math.PI / 2);
  await moveFor(page, 100 / 180);
  await turnTo(page, 0);
  await moveFor(page, 2);
  const stopped = await snapshot(page);
  expect(stopped.player.y).toBeCloseTo(300, -1);
  expect(stopped.player.x).toBeGreaterThan(350);
  expect(stopped.player.x).toBeLessThanOrEqual(358);
  await moveFor(page, 0.5);
  expect((await snapshot(page)).player.x).toBeCloseTo(stopped.player.x, 5);
  await page.keyboard.down('Space');
  await advance(page, 1 / 60);
  await page.keyboard.up('Space');
  await advance(page, 0.1);
  expect((await snapshot(page)).projectiles).toHaveLength(0);
  expect((await snapshot(page)).score).toBe(0);
});

test('honors front cooldown without blocking the independent mouse broadside', async ({ page }) => {
  await begin(page);
  await page.keyboard.down('Space');
  await advance(page, 1 / 60);
  const initial = (await snapshot(page)).projectiles[0]!;
  await advance(page, 23 / 60);
  expect((await snapshot(page)).projectiles.filter((shot) => shot.weapon === 'front')).toHaveLength(
    1,
  );
  const bounds = (await page.getByLabel('Naval battle arena').boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down({ button: 'left' });
  await advance(page, 1 / 60);
  await page.mouse.up({ button: 'left' });
  const ready = await snapshot(page);
  expect(ready.projectiles.filter((shot) => shot.weapon === 'front')).toHaveLength(2);
  expect(ready.projectiles.filter((shot) => shot.weapon === 'port')).toHaveLength(3);
  expect(ready.projectiles.some((shot) => shot.id === initial.id)).toBe(true);
  await page.keyboard.up('Space');
});

test('honors the lateral cooldown even after releasing and pressing again', async ({ page }) => {
  await begin(page);
  await page.keyboard.down('e');
  await advance(page, 1 / 60);
  await page.keyboard.up('e');
  const firstIds = (await snapshot(page)).projectiles.map((shot) => shot.id);
  await advance(page, 64 / 60);
  await page.keyboard.down('e');
  await advance(page, 1 / 60);
  expect(
    (await snapshot(page)).projectiles.filter((shot) => !firstIds.includes(shot.id)),
  ).toHaveLength(0);
  await advance(page, 1 / 60);
  await page.keyboard.up('e');
  expect(
    (await snapshot(page)).projectiles.filter((shot) => !firstIds.includes(shot.id)),
  ).toHaveLength(3);
});

test('spawns Chaser then Shooter at the saved interval with the same seed', async ({ page }) => {
  await begin(page, 3);
  await advance(page, 179 / 60);
  expect((await snapshot(page)).enemies).toHaveLength(0);
  await advance(page, 1 / 60);
  const chaser = (await snapshot(page)).enemies[0]!;
  expect(chaser.kind).toBe('chaser');
  expect(Math.hypot(chaser.x - 120, chaser.y - 200)).toBeGreaterThanOrEqual(280);
  await advance(page, 179 / 60);
  expect((await snapshot(page)).enemies).toHaveLength(1);
  await advance(page, 1 / 60);
  expect((await snapshot(page)).enemies.map((enemy) => enemy.kind)).toEqual(['chaser', 'shooter']);
});

test('damages a naturally spawned Chaser and awards its destruction once', async ({ page }) => {
  await begin(page, 3);
  await advance(page, 3);
  const enemy = (await snapshot(page)).enemies[0]!;
  await aimAt(page, enemy);
  await page.keyboard.down('Space');
  await advance(page, 1 / 60);
  await page.keyboard.up('Space');
  await advance(page, 0.9);
  expect((await snapshot(page)).enemies.find((ship) => ship.id === enemy.id)?.hp).toBe(20);
  expect((await snapshot(page)).score).toBe(0);
  await aimAt(
    page,
    (await snapshot(page)).enemies.find((ship) => ship.id === enemy.id)!,
  );
  await page.keyboard.down('Space');
  await advance(page, 1 / 60);
  await page.keyboard.up('Space');
  await advance(page, 1);
  expect((await snapshot(page)).enemies.some((ship) => ship.id === enemy.id)).toBe(false);
  expect((await snapshot(page)).score).toBe(1);
  await advance(page, 0.5);
  expect((await snapshot(page)).score).toBe(1);
  await expect(page.getByLabel('Score')).toContainText('1');
});

test('damages and destroys a natural enemy with a real lateral mouse volley', async ({ page }) => {
  await begin(page, 3);
  await advance(page, 3);
  const enemy = (await snapshot(page)).enemies[0]!;
  await aimAt(page, enemy, Math.PI / 2);
  const bounds = (await page.getByLabel('Naval battle arena').boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down({ button: 'right' });
  await advance(page, 1 / 60);
  await page.mouse.up({ button: 'right' });
  await advance(page, 1.2);
  expect((await snapshot(page)).enemies.some((ship) => ship.id === enemy.id)).toBe(false);
  expect((await snapshot(page)).score).toBe(1);
  await advance(page, 0.5);
  expect((await snapshot(page)).score).toBe(1);
});

test('Chaser approaches and deals one contact hit without awarding a point', async ({ page }) => {
  await begin(page, 15);
  await advance(page, 15);
  const first = (await snapshot(page)).enemies[0]!;
  await advance(page, 1);
  const closer = (await snapshot(page)).enemies[0]!;
  expect(Math.hypot(closer.x - 120, closer.y - 200)).toBeLessThan(
    Math.hypot(first.x - 120, first.y - 200),
  );
  await advance(page, 5);
  const impact = await snapshot(page);
  expect(impact.player.hp).toBe(75);
  expect(impact.enemies.some((ship) => ship.id === first.id)).toBe(false);
  expect(impact.score).toBe(0);
  await advance(page, 1);
  expect((await snapshot(page)).player.hp).toBe(75);
});

test('Shooter approaches into range then fires and damages the player', async ({ page }) => {
  await begin(page, 3);
  await advance(page, 6);
  const shooter = (await snapshot(page)).enemies.find((ship) => ship.kind === 'shooter')!;
  const firstDistance = Math.hypot(shooter.x - 120, shooter.y - 200);
  expect(firstDistance).toBeGreaterThan(260);
  expect((await snapshot(page)).projectiles.some((shot) => shot.owner === 'enemy')).toBe(false);
  let shotSeen = false;
  for (let step = 0; step < 150; step++) {
    await advance(page, 0.1);
    const state = await snapshot(page);
    const shots = state.projectiles.filter((shot) => shot.owner === 'enemy');
    if (shots.length) {
      const firing = state.enemies.find((ship) => ship.id === shooter.id)!;
      expect(Math.hypot(firing.x - state.player.x, firing.y - state.player.y)).toBeLessThanOrEqual(
        260,
      );
      expect(Math.hypot(firing.x - 120, firing.y - 200)).toBeLessThan(firstDistance);
      const firedAt = state.elapsed;
      let previousHp = state.player.hp;
      let projectileHit = false;
      for (let flight = 0; flight < 24; flight++) {
        await advance(page, 0.05);
        const hp = (await snapshot(page)).player.hp;
        if (previousHp - hp === 12) {
          projectileHit = true;
          break;
        }
        previousHp = hp; // A concurrent Chaser contact is a separate 25 HP hit.
      }
      expect(projectileHit).toBe(true);
      await advance(page, firedAt + 1.65 - (await snapshot(page)).elapsed);
      expect(
        (await snapshot(page)).projectiles.filter((shot) => shot.owner === 'enemy'),
      ).toHaveLength(0);
      await advance(page, 0.25);
      expect(
        (await snapshot(page)).projectiles.filter((shot) => shot.owner === 'enemy'),
      ).toHaveLength(1);
      shotSeen = true;
      break;
    }
  }
  expect(shotSeen).toBe(true);
});

test('ends exactly on time while sailing, persists the result and restarts cleanly', async ({
  page,
}) => {
  await begin(page, 15, 60);
  const oldHarness = await page.evaluateHandle(() => window.__gameTest!);
  await page.keyboard.down('w');
  await page.keyboard.down('d');
  await advance(page, 60);
  await page.keyboard.up('w');
  await page.keyboard.up('d');
  await expect(page.getByText('Time elapsed', { exact: true })).toBeVisible();
  const finished = await oldHarness.evaluate((harness) => harness.snapshot());
  expect(finished.elapsed).toBe(60);
  expect(finished.reason).toBe('time');
  await oldHarness.evaluate((harness) => harness.advance(10));
  expect(await oldHarness.evaluate((harness) => harness.snapshot())).toEqual(finished);
  await page.reload();
  await page.getByRole('button', { name: 'Last voyage' }).click();
  await expect(page.getByText('Time elapsed', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Play Again' }).click();
  await page.getByRole('button', { name: 'Set sail', exact: true }).click();
  const replay = await snapshot(page);
  expect(replay.elapsed).toBe(0);
  expect(replay.score).toBe(0);
  expect(replay.player.hp).toBe(100);
  expect(replay.enemies).toHaveLength(0);
  expect(replay.projectiles).toHaveLength(0);
  await expect(page.getByLabel('Naval battle arena')).toHaveCount(1);
  await oldHarness.dispose();
});

test('ends by actual enemy damage and stops the departed simulation', async ({ page }) => {
  await begin(page, 0.5, 180);
  const oldHarness = await page.evaluateHandle(() => window.__gameTest!);
  await advance(page, 180);
  await expect(page.getByText('Ship sunk', { exact: true })).toBeVisible();
  const sunk = await oldHarness.evaluate((harness) => harness.snapshot());
  expect(sunk.player.hp).toBe(0);
  expect(sunk.reason).toBe('death');
  expect(sunk.elapsed).toBeLessThan(180);
  await oldHarness.evaluate((harness) => harness.advance(20));
  expect(await oldHarness.evaluate((harness) => harness.snapshot())).toEqual(sunk);
  await oldHarness.dispose();
});

test('runs the three-minute profiling workload through real sailing and firing inputs', async ({
  page,
}) => {
  await begin(page, 15, 180, 1);
  const observed = await page.evaluateHandle(() => window.__gameTest!);
  for (const key of ['w', 'd', 'Space', 'q', 'e']) await page.keyboard.down(key);
  await advance(page, 180);
  for (const key of ['w', 'd', 'Space', 'q', 'e']) await page.keyboard.up(key);
  const state = await observed.evaluate((harness) => harness.snapshot());
  expect(state.reason).toBe('time');
  expect(state.elapsed).toBe(180);
  expect(state.player.hp).toBeGreaterThan(0);
  expect(state.score).toBeGreaterThan(0);
  await observed.dispose();
});
