import { describe, expect, it } from 'vitest';
import type { Projectile } from '../types';
import { ProjectileTrails } from './projectileTrails';

const options = { spacing: 12, lifetime: 0.4, maxParticles: 180, radius: 3, growth: 8, drift: 4 };
const ball: Projectile = {
  id: 'ball-1',
  x: 0,
  y: 0,
  angle: 0,
  owner: 'player',
  weapon: 'front',
  damage: 20,
  speed: 240,
  remaining: 1.4,
  remainingRange: 336,
};

describe('projectile smoke', () => {
  it('leaves smoke along the traveled path at consistent spatial intervals', () => {
    const trail = new ProjectileTrails(options);
    trail.update([ball], 0);
    trail.update([{ ...ball, x: 36 }], 0.15);
    expect(trail.snapshot().map((puff) => puff.originX)).toEqual([0, 12, 24, 36]);
  });

  it('keeps the same trail at different render rates and adds nothing while paused', () => {
    const coarse = new ProjectileTrails(options);
    const fine = new ProjectileTrails(options);
    coarse.update([ball], 0);
    fine.update([ball], 0);
    coarse.update([{ ...ball, x: 36 }], 0.15);
    for (let i = 1; i <= 9; i++) fine.update([{ ...ball, x: i * 4 }], i / 60);
    expect(fine.snapshot().map((puff) => puff.originX)).toEqual(
      coarse.snapshot().map((puff) => puff.originX),
    );
    expect(fine.snapshot().map((puff) => puff.originX)).toEqual([0, 12, 24, 36]);
    const before = fine.snapshot();
    fine.update([{ ...ball, x: 36 }], 0.15);
    expect(fine.snapshot()).toEqual(before);
  });

  it('expands and fades lingering smoke after a projectile is removed, then releases it', () => {
    const trail = new ProjectileTrails(options);
    trail.update([ball], 0);
    expect(trail.snapshot()).toHaveLength(1);
    const initial = trail.snapshot()[0]!;
    trail.update([], 0.2);
    expect(trail.snapshot()[0]!.radius).toBeGreaterThan(initial.radius);
    expect(trail.snapshot()[0]!.alpha).toBeLessThan(initial.alpha);
    trail.update([], 0.4);
    expect(trail.snapshot()).toHaveLength(0);
    expect(trail.trackedProjectiles).toBe(0);
  });

  it('bounds particle counts and clears retained state on disposal', () => {
    const trail = new ProjectileTrails({ ...options, maxParticles: 3 });
    trail.update([ball], 0);
    trail.update([{ ...ball, x: 120 }], 0.3);
    expect(trail.snapshot()).toHaveLength(3);
    trail.clear();
    expect(trail.snapshot()).toHaveLength(0);
    expect(trail.trackedProjectiles).toBe(0);
  });
});
