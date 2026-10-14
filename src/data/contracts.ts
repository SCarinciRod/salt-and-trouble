import { DEFAULT_OPTIONS, makeGameConfig, validateOptions, type GameConfig } from '../game/config';
import type { MatchResult } from '../game/types';

export interface MatchRecord extends MatchResult {
  configKey: string;
}
export interface RankingEntry extends MatchRecord {
  rank: number;
}
export interface PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
export interface PageRequest {
  page: number;
  pageSize: number;
}
export interface RankingRequest extends PageRequest {
  configKey: string;
}
export interface HistoryRequest extends PageRequest {
  playerId: string;
}

export const PAGE_SIZE = 5;
export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (isObject(value))
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}

export function configurationKey(config: GameConfig): string {
  const { sessionSeconds, spawnSeconds, arena, player, enemies, weapons, spawn, islands } = config;
  return `balance-v2:${JSON.stringify(canonical({ sessionSeconds, spawnSeconds, arena, player, enemies, weapons, spawn, islands }))}`;
}

function normalizeShape(template: unknown, value: unknown, path: string): unknown {
  if (typeof template === 'number') {
    const allowsZero = /\.(x|y|drift|growth)$/.test(path);
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      (allowsZero ? value < 0 : value <= 0)
    )
      throw new Error('Invalid numeric configuration');
    return value;
  }
  if (Array.isArray(template)) {
    if (!Array.isArray(value) || value.length === 0 || value.length > 64)
      throw new Error('Invalid configuration array');
    if (path === 'spawn.pattern') {
      if (
        !value.every((kind) => kind === 'chaser' || kind === 'shooter') ||
        !value.includes('chaser') ||
        !value.includes('shooter')
      )
        throw new Error('Both enemy types are required');
      return [...value];
    }
    return value.map((item) => normalizeShape(template[0], item, path));
  }
  if (isObject(template) && isObject(value)) {
    return Object.fromEntries(
      Object.entries(template).map(([key, expected]) => [
        key,
        normalizeShape(expected, value[key], path ? `${path}.${key}` : key),
      ]),
    );
  }
  throw new Error('Invalid configuration structure');
}

export function parseGameConfig(value: unknown): GameConfig | null {
  if (!isObject(value)) return null;
  try {
    const input = structuredClone(value);
    const defaults = makeGameConfig(DEFAULT_OPTIONS);
    if (input.visuals === undefined) input.visuals = defaults.visuals;
    if (isObject(input.weapons)) {
      for (const weapon of Object.values(input.weapons)) {
        if (
          isObject(weapon) &&
          weapon.range === undefined &&
          typeof weapon.speed === 'number' &&
          typeof weapon.lifetime === 'number'
        )
          weapon.range = weapon.speed * weapon.lifetime;
      }
      if (
        isObject(input.enemies) &&
        isObject(input.enemies.shooter) &&
        typeof input.enemies.shooter.cooldown === 'number' &&
        isObject(input.weapons.enemy)
      )
        input.weapons.enemy.cooldown = input.enemies.shooter.cooldown;
    }
    const config = normalizeShape(defaults, input, '') as GameConfig;
    if (Object.keys(validateOptions(config)).length) return null;
    if (config.player.radius * 2 >= Math.min(config.arena.width, config.arena.height)) return null;
    if (
      config.islands.some(
        (island) =>
          island.x + island.width > config.arena.width ||
          island.y + island.height > config.arena.height,
      )
    )
      return null;
    return config;
  } catch {
    return null;
  }
}

function text(value: unknown, maxLength: number) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

export function parseMatchResult(value: unknown): MatchResult | null {
  if (!isObject(value)) return null;
  const { id, playerId, playerName, completedAt, score, playedSeconds, reason } = value;
  if (
    !text(id, 128) ||
    !text(playerId, 128) ||
    !text(playerName, 64) ||
    typeof completedAt !== 'string' ||
    !Number.isFinite(Date.parse(completedAt))
  )
    return null;
  if (
    typeof score !== 'number' ||
    !Number.isInteger(score) ||
    score < 0 ||
    typeof playedSeconds !== 'number' ||
    !Number.isFinite(playedSeconds) ||
    playedSeconds < 0 ||
    (reason !== 'time' && reason !== 'death')
  )
    return null;
  const config = parseGameConfig(value.config);
  if (
    !config ||
    playedSeconds > config.sessionSeconds + 1e-6 ||
    (reason === 'time' && Math.abs(playedSeconds - config.sessionSeconds) > 1e-6)
  )
    return null;
  return {
    id: id as string,
    playerId: playerId as string,
    playerName: playerName as string,
    completedAt,
    score,
    playedSeconds,
    reason,
    config,
  };
}

export function parseMatchRecord(value: unknown): MatchRecord | null {
  const result = parseMatchResult(value);
  if (!result) return null;
  const configKey = configurationKey(result.config);
  if (isObject(value) && value.configKey !== undefined && value.configKey !== configKey)
    return null;
  return { ...result, configKey };
}

export function parsePage<T>(
  value: unknown,
  parseItem: (item: unknown) => T | null,
): PagedResponse<T> {
  if (
    !isObject(value) ||
    !Array.isArray(value.items) ||
    !Number.isInteger(value.page) ||
    (value.page as number) < 1 ||
    !Number.isInteger(value.pageSize) ||
    (value.pageSize as number) < 1 ||
    !Number.isInteger(value.total) ||
    (value.total as number) < 0
  )
    throw new Error('Invalid page response');
  const items = value.items.map(parseItem);
  if (items.some((item) => item === null)) throw new Error('Invalid record in page response');
  return {
    items: items as T[],
    page: value.page as number,
    pageSize: value.pageSize as number,
    total: value.total as number,
  };
}
