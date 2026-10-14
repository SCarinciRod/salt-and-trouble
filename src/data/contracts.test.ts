import { describe, expect, it } from 'vitest';
import { configurationKey, parseMatchRecord } from './contracts';
import { DEFAULT_OPTIONS, makeGameConfig } from '../game/config';

const record = () => ({
  id: 'match-1',
  playerId: 'player-1',
  playerName: 'Captain Bad Idea',
  completedAt: '2026-10-12T23:00:00.000Z',
  score: 3,
  playedSeconds: 60,
  reason: 'time',
  config: makeGameConfig({ sessionSeconds: 60, spawnSeconds: 3 }),
});

describe('match data contracts', () => {
  it('accepts a complete record and derives its configuration key', () => {
    const value = parseMatchRecord(record());
    expect(value?.id).toBe('match-1');
    expect(value?.configKey).toContain('balance-v2:');
  });
  it('groups equivalent balance despite object key order and visual-only settings', () => {
    const a = makeGameConfig(DEFAULT_OPTIONS);
    const b = structuredClone(a);
    b.player = {
      radius: a.player.radius,
      turnSpeed: a.player.turnSpeed,
      speed: a.player.speed,
      maxHp: a.player.maxHp,
    };
    b.visuals.smoke.spacing = 10;
    expect(configurationKey(a)).toBe(configurationKey(b));
  });
  it('separates different balance settings', () => {
    const a = makeGameConfig(DEFAULT_OPTIONS);
    const b = structuredClone(a);
    b.weapons.front.damage = 21;
    expect(configurationKey(a)).not.toBe(configurationKey(b));
  });
  it.each([
    { score: -1 },
    { score: 1.5 },
    { id: '' },
    { playerId: '' },
    { completedAt: 'not a date' },
    { playedSeconds: -1 },
    { playedSeconds: 61 },
    { reason: 'abandoned' },
    { config: { sessionSeconds: 60 } },
  ])('rejects invalid records: %j', (change) => {
    expect(parseMatchRecord({ ...record(), ...change })).toBe(null);
  });
  it('rejects nonfinite nested balance values', () => {
    const value = record();
    value.config.player.speed = Infinity;
    expect(parseMatchRecord(value)).toBe(null);
  });
  it('restores legacy equivalent range and cosmetic settings without changing old balance', () => {
    const value = record();
    const old = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
    const config = old.config as Record<string, unknown>;
    delete config.visuals;
    const weapons = config.weapons as Record<string, Record<string, unknown>>;
    for (const weapon of Object.values(weapons)) delete weapon.range;
    const restored = parseMatchRecord(old);
    expect(restored?.config.weapons.front.range).toBeCloseTo(602);
    expect(restored?.config.player.speed).toBe(180);
    expect(restored?.config.visuals.cannonball.diameter).toBe(10);
  });
});
