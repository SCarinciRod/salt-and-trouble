import { test, expect } from '@playwright/test';
import type { MatchRecord, PagedResponse, RankingEntry } from '../src/data/contracts';

test('exposes read-only profiling only when requested and removes it on exit', async ({ page }) => {
  await page.goto('/?profile=1&seed=42');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Set sail', exact: true }).click();
  await expect(page.getByLabel('Match status')).toHaveText('Running');
  await expect
    .poll(() => page.evaluate(() => Object.keys(window.__gameProfile ?? {})))
    .toEqual(['snapshot']);
  const initial = await page.evaluate(() => window.__gameProfile!.snapshot());
  expect(initial.seed).toBe(42);
  expect(initial.entities.ships).toBe(1);
  expect(initial.config.sessionSeconds).toBe(120);
  expect(initial.renderer.canvasWidth).toBeGreaterThan(0);
  await page.keyboard.down('w');
  await expect
    .poll(() => page.evaluate(() => window.__gameProfile!.snapshot().elapsed))
    .toBeGreaterThan(0.2);
  await page.keyboard.up('w');
  const frames = await page.evaluate(() => window.__gameProfile!.snapshot().frameIntervals.length);
  expect(frames).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const paused = await page.evaluate(() => window.__gameProfile!.snapshot().elapsed);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__gameProfile!.snapshot().elapsed)).toBe(paused);
  await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
  expect(await page.evaluate(() => window.__gameProfile)).toBeUndefined();
  expect(await page.evaluate(() => window.__gameTest)).toBeUndefined();
});

test('runs the published worker, persists API records and omits the test harness', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const rankingResponse = page.waitForResponse(
    (response) => response.url().includes('/api/ranking?') && response.status() === 200,
  );
  await page.goto('/');
  await expect(page.getByRole('table', { name: 'Ranking', exact: true })).toBeVisible();
  const ranking = (await (await rankingResponse).json()) as PagedResponse<RankingEntry>;
  const fixture = ranking.items[0]!;
  const stored = (await page.evaluate(async (sample) => {
    const result = {
      ...sample,
      id: crypto.randomUUID(),
      playerId: localStorage.getItem('salt-and-trouble:player:v1')!,
      playerName: 'Captain Bad Idea',
      completedAt: new Date().toISOString(),
      score: 99,
      playedSeconds: sample.config.sessionSeconds,
      reason: 'time',
    };
    const response = await fetch('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    });
    const record = await response.json();
    const repeated = await fetch('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    });
    return { status: response.status, repeated: repeated.status, record };
  }, fixture)) as { status: number; repeated: number; record: MatchRecord };
  expect(stored.status).toBe(201);
  expect(stored.repeated).toBe(200);
  await page.getByRole('tab', { name: 'Match History', exact: true }).click();
  await expect(
    page.getByRole('table', { name: 'Match History', exact: true }).getByRole('row'),
  ).toHaveCount(2);
  await page.reload();
  await page.getByRole('tab', { name: 'Match History', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Match History', exact: true })).toContainText('99');
  await page.getByRole('tab', { name: 'Ranking', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Ranking', exact: true })).toContainText(
    'Captain Bad Idea',
  );
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Set sail', exact: true }).click();
  await expect(page.getByLabel('Match status')).toHaveText('Running');
  expect(await page.evaluate(() => window.__gameTest)).toBeUndefined();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Main Menu' }).click();
  expect(errors).toEqual([]);
});
