import { expect, it } from 'vitest';
import {
  addPending,
  getPending,
  removePending,
  saveLastResult,
  loadLastResult,
  getConfirmation,
  rememberConfirmation,
} from './results';
import { parseMatchRecord } from '../data/contracts';
import { makeGameConfig } from '../game/config';
import type { MatchResult } from '../game/types';

const result: MatchResult = {
  id: 'round-1',
  playerId: 'captain-1',
  playerName: 'Captain Bad Idea',
  completedAt: '2026-10-12T23:00:00.000Z',
  score: 4,
  playedSeconds: 60,
  reason: 'time',
  config: makeGameConfig({ sessionSeconds: 60, spawnSeconds: 3 }),
};
const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
  };
};

it('keeps a finished result through a new read', () => {
  const memory = storage();
  saveLastResult(result, memory);
  expect(loadLastResult(memory)).toEqual(result);
});
it('preserves several pending results and deduplicates their identifiers', () => {
  const memory = storage();
  addPending(result, memory);
  addPending(result, memory);
  addPending({ ...result, id: 'round-2' }, memory);
  expect(getPending(memory).map((match) => match.id)).toEqual(['round-1', 'round-2']);
  removePending('round-1', memory);
  expect(getPending(memory).map((match) => match.id)).toEqual(['round-2']);
});
it('recovers from malformed results and unavailable storage', () => {
  const corrupt = {
    getItem: () => '[1, null, {}]',
    setItem: () => {
      throw new Error('blocked');
    },
    removeItem: () => {},
    key: () => null,
    length: 0,
  };
  expect(loadLastResult(corrupt)).toBe(null);
  expect(getPending(corrupt)).toEqual([]);
  expect(saveLastResult(result, corrupt)).toBe(false);
});

it('retains multiple results in memory when persistence is unavailable', () => {
  const blocked = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
    removeItem: () => {
      throw new Error('blocked');
    },
    key: () => null,
    length: 0,
  };
  expect(addPending(result, blocked)).toBe(false);
  expect(addPending({ ...result, id: 'round-2' }, blocked)).toBe(false);
  expect(getPending(blocked).map((match) => match.id)).toEqual(['round-1', 'round-2']);
});

it('does not lose an interleaved pending match from another writer', () => {
  const memory = storage();
  const originalSet = memory.setItem;
  let interleaved = false;
  memory.setItem = (key, value) => {
    if (!interleaved) {
      interleaved = true;
      addPending({ ...result, id: 'round-2' }, memory);
    }
    originalSet(key, value);
  };
  addPending(result, memory);
  expect(getPending(memory).map((match) => match.id)).toEqual(['round-1', 'round-2']);
});

it('keeps the newest result in memory when its write fails after an older result was saved', () => {
  const memory = storage();
  saveLastResult(result, memory);
  memory.setItem = () => {
    throw new Error('quota');
  };
  const newer = { ...result, id: 'newer', completedAt: '2026-10-13T00:00:00.000Z' };
  saveLastResult(newer, memory);
  expect(loadLastResult(memory)?.id).toBe('newer');
});

it('retains a confirmed receipt in memory when its local write fails', () => {
  const memory = storage();
  memory.setItem = () => {
    throw new Error('quota');
  };
  const confirmed = parseMatchRecord(result)!;
  expect(rememberConfirmation(confirmed, memory)).toBe(false);
  expect(getConfirmation(confirmed.id, memory)).toEqual(confirmed);
});
