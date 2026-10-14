import { describe, expect, it } from 'vitest';
import { Simulation } from './world';
import { makeGameConfig } from '../config';

const create = (sessionSeconds = 60, spawnSeconds = 3) =>
  new Simulation(makeGameConfig({ sessionSeconds, spawnSeconds }), 42);

describe('simulation rules', () => {
  it('uses a configuration snapshot even if the source balance changes', () => {
    const config = makeGameConfig({ sessionSeconds: 60, spawnSeconds: 3 });
    const game = new Simulation(config, 42);
    config.player.speed = 999;
    game.step(0.5, { forward: true });
    expect(game.player.x).toBeCloseTo(210, 2);
  });
  it('expires a projectile at configured range before reaching a distant target', () => {
    const config = makeGameConfig({ sessionSeconds: 60, spawnSeconds: 3 });
    config.weapons.front.range = 30;
    const game = new Simulation(config, 42);
    game.enemies.push({
      id: 'distant',
      kind: 'shooter',
      x: 240,
      y: 200,
      angle: Math.PI,
      hp: 60,
      maxHp: 60,
      cooldown: 100,
    });
    game.step(0.01, { front: true });
    game.step(0.2, {});
    expect(game.projectiles).toHaveLength(0);
    expect(game.enemies[0]!.hp).toBe(60);
  });
  it('moves the same distance for the same active time at different step sizes', () => {
    const a = create();
    const b = create();
    for (let i = 0; i < 60; i++) a.step(1 / 60, { forward: true });
    for (let i = 0; i < 120; i++) b.step(1 / 120, { forward: true });
    expect(a.player.x).toBeCloseTo(300, 3);
    expect(a.player.x).toBeCloseTo(b.player.x, 3);
  });
  it('rotates and moves simultaneously', () => {
    const game = create();
    game.step(0.5, { forward: true, right: true });
    expect(game.player.angle).toBeCloseTo(1.1, 3);
    expect(game.player.y).toBeGreaterThan(200);
  });
  it('blocks movement at an island and at the visible arena boundary', () => {
    const game = create();
    game.player.x = 340;
    game.player.y = 300;
    game.step(0.2, { forward: true });
    expect(game.player.x).toBeLessThanOrEqual(358);
    expect(game.player.x).toBeGreaterThan(340);
    game.player.x = 980;
    game.player.y = 200;
    game.step(1, { forward: true });
    expect(game.player.x).toBeLessThanOrEqual(992);
  });
  it('fires one frontal and three parallel shots on each side with independent cooldowns', () => {
    const game = create();
    game.step(1 / 60, { front: true, port: true, starboard: true });
    expect(game.projectiles).toHaveLength(7);
    const port = game.projectiles.filter((shot) => shot.weapon === 'port');
    expect(port).toHaveLength(3);
    expect(new Set(port.map((shot) => shot.angle)).size).toBe(1);
    game.step(1 / 60, { front: true, port: true, starboard: true });
    expect(game.projectiles).toHaveLength(7);
  });
  it('removes an obstructed projectile rather than hitting through an island', () => {
    const game = create();
    game.player.x = 330;
    game.player.y = 300;
    game.step(0.01, { front: true });
    game.step(0.5, {});
    expect(game.projectiles).toHaveLength(0);
  });
  it('scores one point for one destroyed enemy, never for a repeated collision', () => {
    const game = create();
    game.enemies.push({
      id: 'target',
      kind: 'shooter',
      x: 240,
      y: 200,
      angle: 0,
      hp: 1,
      maxHp: 1,
      cooldown: 100,
    });
    game.step(0.01, { front: true });
    game.step(0.2, {});
    expect(game.score).toBe(1);
    expect(game.enemies).toHaveLength(0);
    game.step(0.2, {});
    expect(game.score).toBe(1);
  });
  it('damages the player on chaser impact without awarding a point', () => {
    const game = create();
    game.enemies.push({
      id: 'ram',
      kind: 'chaser',
      x: 130,
      y: 200,
      angle: Math.PI,
      hp: 40,
      maxHp: 40,
      cooldown: 0,
    });
    game.step(0.01, {});
    expect(game.player.hp).toBe(75);
    expect(game.score).toBe(0);
    expect(game.enemies).toHaveLength(0);
  });
  it('spawns both enemy types safely at the configured interval', () => {
    const game = create(60, 1);
    game.step(1, {});
    expect(game.enemies).toHaveLength(1);
    game.step(1, {});
    expect(new Set(game.enemies.map((enemy) => enemy.kind))).toEqual(
      new Set(['chaser', 'shooter']),
    );
    expect(
      game.enemies.every(
        (enemy) => Math.hypot(enemy.x - game.player.x, enemy.y - game.player.y) > 200,
      ),
    ).toBe(true);
  });
  it('lets a shooter fire when in range', () => {
    const game = create();
    game.enemies.push({
      id: 'shooter',
      kind: 'shooter',
      x: 250,
      y: 200,
      angle: Math.PI,
      hp: 60,
      maxHp: 60,
      cooldown: 0,
    });
    game.step(0.01, {});
    expect(game.projectiles.some((shot) => shot.owner === 'enemy')).toBe(true);
  });
  it('freezes simulation and cooldowns while paused', () => {
    const game = create();
    game.step(0.1, { front: true });
    game.pause();
    const before = structuredClone(game.snapshot());
    game.step(20, { forward: true, front: true });
    expect(game.snapshot()).toEqual(before);
    game.resume();
    game.step(0.1, {});
    expect(game.elapsed).toBeCloseTo(0.2);
  });
  it('finishes at the active-time deadline and never advances afterwards', () => {
    const config = makeGameConfig({ sessionSeconds: 60, spawnSeconds: 15 });
    config.player.maxHp = 100_000;
    const game = new Simulation(config, 42);
    for (let i = 0; i < 60; i++) game.step(1, {});
    expect(game.status).toBe('finished');
    expect(game.reason).toBe('time');
    const before = structuredClone(game.snapshot());
    game.step(1, { forward: true, front: true });
    expect(game.snapshot()).toEqual(before);
  });
  it('finishes when player health reaches zero', () => {
    const game = create();
    game.player.hp = 0;
    game.step(0.01, {});
    expect(game.status).toBe('finished');
    expect(game.reason).toBe('death');
  });
});
