import type { Projectile } from '../types';

export interface SmokeOptions {
  spacing: number;
  lifetime: number;
  maxParticles: number;
  radius: number;
  growth: number;
  drift: number;
}
export interface SmokeView {
  originX: number;
  x: number;
  y: number;
  radius: number;
  alpha: number;
  owner: Projectile['owner'];
}

export class ProjectileTrails {
  private readonly tracks = new Map<string, { x: number; y: number; sampledAt: number }>();
  private particles: {
    x: number;
    y: number;
    angle: number;
    bornAt: number;
    owner: Projectile['owner'];
  }[] = [];
  private activeTime = 0;

  constructor(private readonly options: SmokeOptions) {}

  update(projectiles: readonly Projectile[], activeTime: number) {
    this.activeTime = activeTime;
    const liveIds = new Set(projectiles.map((projectile) => projectile.id));
    for (const id of this.tracks.keys()) if (!liveIds.has(id)) this.tracks.delete(id);

    for (const projectile of projectiles) {
      const track = this.tracks.get(projectile.id);
      if (!track) {
        this.emit(projectile.x, projectile.y, projectile, activeTime);
        this.tracks.set(projectile.id, { x: projectile.x, y: projectile.y, sampledAt: activeTime });
        continue;
      }
      const dx = projectile.x - track.x;
      const dy = projectile.y - track.y;
      const traveled = Math.hypot(dx, dy);
      const samples = Math.floor((traveled + 1e-9) / this.options.spacing);
      const fromX = track.x;
      const fromY = track.y;
      const fromTime = track.sampledAt;
      for (let index = 1; index <= samples; index++) {
        const fraction = Math.min(1, (index * this.options.spacing) / traveled);
        const x = fromX + dx * fraction;
        const y = fromY + dy * fraction;
        const sampledAt = fromTime + (activeTime - fromTime) * fraction;
        this.emit(x, y, projectile, sampledAt);
        track.x = x;
        track.y = y;
        track.sampledAt = sampledAt;
      }
    }
    this.particles = this.particles
      .filter((particle) => activeTime - particle.bornAt < this.options.lifetime - 1e-9)
      .slice(-this.options.maxParticles);
  }

  snapshot(): SmokeView[] {
    return this.particles.map((particle) => {
      const age = Math.max(0, this.activeTime - particle.bornAt);
      const progress = Math.min(1, age / this.options.lifetime);
      return {
        originX: particle.x,
        x: particle.x - Math.cos(particle.angle) * this.options.drift * progress,
        y: particle.y - Math.sin(particle.angle) * this.options.drift * progress,
        radius: this.options.radius + this.options.growth * progress,
        alpha: 0.42 * (1 - progress) ** 1.3,
        owner: particle.owner,
      };
    });
  }

  clear() {
    this.tracks.clear();
    this.particles = [];
  }
  get trackedProjectiles() {
    return this.tracks.size;
  }

  private emit(x: number, y: number, projectile: Projectile, bornAt: number) {
    this.particles.push({ x, y, angle: projectile.angle, bornAt, owner: projectile.owner });
  }
}
