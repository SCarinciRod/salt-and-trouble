import { expect, type Page } from '@playwright/test';

export const snapshot = (page: Page) => page.evaluate(() => window.__gameTest!.snapshot());
export const advance = (page: Page, seconds: number) =>
  page.evaluate((time) => window.__gameTest!.advance(time), seconds);

export async function begin(page: Page, spawn = 15, duration = 60, seed = 42) {
  await page.goto(`/?testClock=manual&seed=${seed}`);
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await page.getByLabel('Game session time').fill(String(duration));
  await page.getByLabel('Enemy spawn time').fill(String(spawn));
  await page.getByRole('button', { name: 'Save options' }).click();
  await page.getByLabel('Close options').click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Set sail', exact: true }).click();
  await expect(page.getByLabel('Match status')).toHaveText('Running');
}

// Each turn and move travels through the actual keyboard listener. The harness
// only observes the world and advances its real fixed-step simulation clock.
export async function turnTo(page: Page, heading: number) {
  const { player } = await snapshot(page);
  const difference = Math.atan2(Math.sin(heading - player.angle), Math.cos(heading - player.angle));
  const key = difference >= 0 ? 'd' : 'a';
  await page.keyboard.down(key);
  await advance(page, Math.abs(difference) / 2.2);
  await page.keyboard.up(key);
}

export async function moveFor(page: Page, seconds: number) {
  await page.keyboard.down('w');
  await advance(page, seconds);
  await page.keyboard.up('w');
}

export async function aimAt(page: Page, point: { x: number; y: number }, offset = 0) {
  const { player } = await snapshot(page);
  await turnTo(page, Math.atan2(point.y - player.y, point.x - player.x) - offset);
}
