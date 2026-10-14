export interface PlayerOptions {
  sessionSeconds: number;
  spawnSeconds: number;
}

export const DEFAULT_OPTIONS: PlayerOptions = { sessionSeconds: 120, spawnSeconds: 3 };

export const OPTION_LIMITS = {
  sessionSeconds: { min: 60, max: 180 },
  spawnSeconds: { min: 0.5, max: 15 },
} as const;

export function validateOptions(
  options: PlayerOptions,
): Partial<Record<keyof PlayerOptions, string>> {
  const errors: Partial<Record<keyof PlayerOptions, string>> = {};
  if (
    !Number.isFinite(options.sessionSeconds) ||
    options.sessionSeconds < OPTION_LIMITS.sessionSeconds.min ||
    options.sessionSeconds > OPTION_LIMITS.sessionSeconds.max
  ) {
    errors.sessionSeconds = 'Choose a session time between 60 and 180 seconds.';
  }
  if (
    !Number.isFinite(options.spawnSeconds) ||
    options.spawnSeconds < OPTION_LIMITS.spawnSeconds.min ||
    options.spawnSeconds > OPTION_LIMITS.spawnSeconds.max
  ) {
    errors.spawnSeconds = 'Choose a spawn time between 0.5 and 15 seconds.';
  }
  return errors;
}

export function makeGameConfig(options: PlayerOptions) {
  return {
    ...options,
    arena: { width: 1024, height: 640 },
    player: { maxHp: 100, speed: 180, turnSpeed: 2.2, radius: 32 },
    enemies: {
      chaser: { maxHp: 40, speed: 80, turnSpeed: 2.5, radius: 32, impactDamage: 25 },
      shooter: { maxHp: 60, speed: 55, turnSpeed: 1.8, radius: 32, attackRange: 260 },
    },
    weapons: {
      front: { cooldown: 0.4, damage: 20, speed: 430, lifetime: 1.4, range: 602 },
      port: { cooldown: 1.1, damage: 20, speed: 380, lifetime: 1.3, range: 494 },
      starboard: { cooldown: 1.1, damage: 20, speed: 380, lifetime: 1.3, range: 494 },
      enemy: { cooldown: 1.8, damage: 12, speed: 240, lifetime: 1.7, range: 408 },
    },
    spawn: { minDistance: 280, pattern: ['chaser', 'shooter'] as ('chaser' | 'shooter')[] },
    visuals: {
      cannonball: { diameter: 10 },
      smoke: { spacing: 8, lifetime: 0.42, maxParticles: 180, radius: 3, growth: 8, drift: 4 },
    },
    islands: [
      { x: 390, y: 224, width: 192, height: 192 },
      { x: 740, y: 70, width: 128, height: 128 },
      { x: 150, y: 450, width: 128, height: 128 },
    ],
  };
}

export type GameConfig = ReturnType<typeof makeGameConfig>;
