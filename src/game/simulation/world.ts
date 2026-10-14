import type { GameConfig } from '../config';
import type {
  Actions,
  Enemy,
  EndReason,
  GameEffect,
  MatchStatus,
  Point,
  Projectile,
  Ship,
  Weapon,
} from '../types';
import {
  circleOverlapsRect,
  clamp,
  distance,
  segmentCircleHit,
  segmentRectHit,
  turnTowards,
} from './geometry';

export class Simulation {
  readonly config: GameConfig;
  player: Ship;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  effects: GameEffect[] = [];
  score = 0;
  elapsed = 0;
  status: MatchStatus = 'running';
  reason: EndReason | null = null;
  private randomState: number;
  private nextId = 0;
  private spawnElapsed = 0;
  private spawnIndex = 0;
  private cooldowns = { front: 0, port: 0, starboard: 0 };

  constructor(config: GameConfig, seed = 1) {
    this.config = structuredClone(config);
    this.randomState = seed >>> 0;
    this.player = {
      id: 'player',
      x: 120,
      y: 200,
      angle: 0,
      hp: config.player.maxHp,
      maxHp: config.player.maxHp,
    };
  }

  step(seconds: number, actions: Actions) {
    if (this.status !== 'running' || !Number.isFinite(seconds) || seconds <= 0) return;
    if (this.player.hp <= 0) {
      this.finish('death');
      return;
    }
    let left = seconds;
    while (left > 1e-9 && this.status === 'running') {
      const delta = Math.min(left, 1 / 60, this.config.sessionSeconds - this.elapsed);
      if (delta <= 1e-9) {
        this.finish('time');
        break;
      }
      this.tick(delta, actions);
      left -= delta;
    }
  }

  pause() {
    if (this.status === 'running') this.status = 'paused';
  }
  resume() {
    if (this.status === 'paused') this.status = 'running';
  }

  private tick(delta: number, actions: Actions) {
    this.elapsed += delta;
    this.player.angle +=
      (Number(!!actions.right) - Number(!!actions.left)) * this.config.player.turnSpeed * delta;
    if (actions.forward)
      this.move(this.player, this.config.player.speed * delta, this.config.player.radius);
    for (const weapon of ['front', 'port', 'starboard'] as const) {
      this.cooldowns[weapon] = Math.max(0, this.cooldowns[weapon] - delta);
      if (actions[weapon] && this.cooldowns[weapon] <= 1e-9) {
        this.fire(this.player, weapon);
        this.cooldowns[weapon] = this.config.weapons[weapon].cooldown;
      }
    }
    this.updateEnemies(delta);
    if (this.player.hp <= 0) {
      this.finish('death');
      return;
    }
    this.updateProjectiles(delta);
    this.enemies = this.enemies.filter((enemy) => enemy.hp > 0);
    if (this.player.hp <= 0) {
      this.finish('death');
      return;
    }
    this.effects = this.effects.filter((effect) => {
      effect.remaining -= delta;
      return effect.remaining > 0;
    });
    if (this.elapsed >= this.config.sessionSeconds - 1e-9) {
      this.elapsed = this.config.sessionSeconds;
      this.finish('time');
      return;
    }
    this.spawnElapsed += delta;
    while (this.spawnElapsed >= this.config.spawnSeconds - 1e-9) {
      this.spawnElapsed -= this.config.spawnSeconds;
      this.spawnEnemy();
    }
  }

  private isFree(point: Point, radius: number) {
    return (
      point.x >= radius &&
      point.y >= radius &&
      point.x <= this.config.arena.width - radius &&
      point.y <= this.config.arena.height - radius &&
      !this.config.islands.some((island) => circleOverlapsRect(point, radius, island))
    );
  }

  private move(ship: Ship, amount: number, radius: number, heading = ship.angle) {
    const target = {
      x: clamp(ship.x + Math.cos(heading) * amount, radius, this.config.arena.width - radius),
      y: clamp(ship.y + Math.sin(heading) * amount, radius, this.config.arena.height - radius),
    };
    if (this.isFree(target, radius)) {
      ship.x = target.x;
      ship.y = target.y;
      return true;
    }
    if (this.isFree({ x: target.x, y: ship.y }, radius)) ship.x = target.x;
    if (this.isFree({ x: ship.x, y: target.y }, radius)) ship.y = target.y;
    return false;
  }

  private updateEnemies(delta: number) {
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) continue;
      const balance = this.config.enemies[enemy.kind];
      const separation = distance(enemy, this.player);
      let aim = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
      const blocked = this.config.islands.find(
        (island) => segmentRectHit(enemy, this.player, island, balance.radius + 8) !== null,
      );
      if (blocked) {
        const margin = balance.radius + 20;
        const corners = [
          { x: blocked.x - margin, y: blocked.y - margin },
          { x: blocked.x + blocked.width + margin, y: blocked.y - margin },
          { x: blocked.x - margin, y: blocked.y + blocked.height + margin },
          { x: blocked.x + blocked.width + margin, y: blocked.y + blocked.height + margin },
        ].filter(
          (corner) =>
            this.isFree(corner, balance.radius) &&
            segmentRectHit(enemy, corner, blocked, balance.radius) === null,
        );
        corners.sort(
          (a, b) =>
            distance(enemy, a) +
            distance(a, this.player) -
            distance(enemy, b) -
            distance(b, this.player),
        );
        const waypoint = corners[0];
        if (waypoint) aim = Math.atan2(waypoint.y - enemy.y, waypoint.x - enemy.x);
      }
      enemy.angle = turnTowards(enemy.angle, aim, balance.turnSpeed * delta);
      if (
        enemy.kind === 'chaser' ||
        blocked ||
        separation > this.config.enemies.shooter.attackRange * 0.65
      )
        this.move(enemy, balance.speed * delta, balance.radius);
      if (
        enemy.kind === 'chaser' &&
        distance(enemy, this.player) < balance.radius + this.config.player.radius
      ) {
        this.player.hp = Math.max(0, this.player.hp - this.config.enemies.chaser.impactDamage);
        enemy.hp = 0;
        this.effect(enemy, 'explosion');
        this.effect(this.player, 'impact');
      }
      if (enemy.kind === 'shooter') {
        enemy.cooldown = Math.max(0, enemy.cooldown - delta);
        const shotAim = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
        const facing =
          Math.abs(Math.atan2(Math.sin(shotAim - enemy.angle), Math.cos(shotAim - enemy.angle))) <
          0.2;
        if (
          separation <= this.config.enemies.shooter.attackRange &&
          facing &&
          enemy.cooldown <= 0 &&
          enemy.hp > 0
        ) {
          this.fire(enemy, 'enemy');
          enemy.cooldown = this.config.weapons.enemy.cooldown;
        }
      }
    }
  }

  private fire(ship: Ship, weapon: Weapon) {
    const balance = this.config.weapons[weapon];
    const angle =
      ship.angle + (weapon === 'port' ? -Math.PI / 2 : weapon === 'starboard' ? Math.PI / 2 : 0);
    const offsets = weapon === 'port' || weapon === 'starboard' ? [-14, 0, 14] : [0];
    for (const offset of offsets) {
      const x = ship.x + Math.cos(angle) * 28 + Math.cos(ship.angle) * offset;
      const y = ship.y + Math.sin(angle) * 28 + Math.sin(ship.angle) * offset;
      this.projectiles.push({
        id: `shot-${this.nextId++}`,
        x,
        y,
        angle,
        owner: weapon === 'enemy' ? 'enemy' : 'player',
        weapon,
        damage: balance.damage,
        speed: balance.speed,
        remaining: balance.lifetime,
        remainingRange: balance.range,
      });
      this.effect({ x, y }, 'shot');
    }
  }

  private updateProjectiles(delta: number) {
    this.projectiles = this.projectiles.filter((shot) => {
      const travel = Math.min(delta, shot.remaining, shot.remainingRange / shot.speed);
      const next = {
        x: shot.x + Math.cos(shot.angle) * shot.speed * travel,
        y: shot.y + Math.sin(shot.angle) * shot.speed * travel,
      };
      let hitFraction = Infinity;
      let target: Ship | undefined;
      for (const island of this.config.islands) {
        const fraction = segmentRectHit(shot, next, island, 3);
        if (fraction !== null && fraction < hitFraction) {
          hitFraction = fraction;
          target = undefined;
        }
      }
      const targets = shot.owner === 'player' ? this.enemies : [this.player];
      for (const ship of targets) {
        if (ship.hp <= 0) continue;
        const radius =
          ship.id === 'player'
            ? this.config.player.radius
            : this.config.enemies[(ship as Enemy).kind].radius;
        const fraction = segmentCircleHit(shot, next, ship, radius + 3);
        if (fraction !== null && fraction < hitFraction) {
          hitFraction = fraction;
          target = ship;
        }
      }
      if (hitFraction !== Infinity) {
        const position = {
          x: shot.x + (next.x - shot.x) * hitFraction,
          y: shot.y + (next.y - shot.y) * hitFraction,
        };
        this.effect(position, 'impact');
        if (target) {
          target.hp = Math.max(0, target.hp - shot.damage);
          if (target.hp === 0 && target.id !== 'player') {
            this.score++;
            this.effect(target, 'explosion');
          }
        }
        return false;
      }
      shot.x = next.x;
      shot.y = next.y;
      shot.remaining -= delta;
      shot.remainingRange -= shot.speed * travel;
      return (
        shot.remaining > 1e-9 &&
        shot.remainingRange > 1e-9 &&
        shot.x >= 0 &&
        shot.y >= 0 &&
        shot.x <= this.config.arena.width &&
        shot.y <= this.config.arena.height
      );
    });
  }

  private random() {
    this.randomState = (Math.imul(1664525, this.randomState) + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }

  private spawnEnemy() {
    const kind = this.config.spawn.pattern[this.spawnIndex % this.config.spawn.pattern.length]!;
    const balance = this.config.enemies[kind];
    for (let attempt = 0; attempt < 50; attempt++) {
      const position = {
        x: 40 + this.random() * (this.config.arena.width - 80),
        y: 40 + this.random() * (this.config.arena.height - 80),
      };
      if (
        !this.isFree(position, balance.radius) ||
        distance(position, this.player) < this.config.spawn.minDistance ||
        this.enemies.some((enemy) => distance(enemy, position) < balance.radius * 3)
      )
        continue;
      this.enemies.push({
        id: `enemy-${this.nextId++}`,
        kind,
        ...position,
        angle: Math.atan2(this.player.y - position.y, this.player.x - position.x),
        hp: balance.maxHp,
        maxHp: balance.maxHp,
        cooldown: 0.5,
      });
      this.spawnIndex++;
      return;
    }
  }

  private effect(position: Point, kind: GameEffect['kind']) {
    const duration = kind === 'explosion' ? 0.65 : kind === 'impact' ? 0.3 : 0.16;
    this.effects.push({
      id: `effect-${this.nextId++}`,
      ...position,
      kind,
      duration,
      remaining: duration,
    });
  }

  private finish(reason: EndReason) {
    this.status = 'finished';
    this.reason = reason;
  }
  snapshot() {
    return {
      player: { ...this.player },
      enemies: this.enemies.map((enemy) => ({ ...enemy })),
      projectiles: this.projectiles.map((shot) => ({ ...shot })),
      score: this.score,
      elapsed: this.elapsed,
      status: this.status,
      reason: this.reason,
    };
  }
}
