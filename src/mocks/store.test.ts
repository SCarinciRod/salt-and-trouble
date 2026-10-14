import { describe, expect, it } from 'vitest';
import { MockStore } from './store';
import { configurationKey, parseMatchRecord } from '../data/contracts';
import { DEFAULT_OPTIONS, makeGameConfig } from '../game/config';

function memory() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
    key: (i: number) => [...values.keys()][i] ?? null,
    get length() {
      return values.size;
    },
  };
}
const record = (id: string, score = 3, playerId = 'captain-1') =>
  parseMatchRecord({
    id,
    playerId,
    playerName: 'Captain Bad Idea',
    completedAt: '2026-10-12T23:00:00.000Z',
    score,
    playedSeconds: 120,
    reason: 'time',
    config: makeGameConfig(DEFAULT_OPTIONS),
  })!;
const filter = {
  configKey: configurationKey(makeGameConfig(DEFAULT_OPTIONS)),
  page: 1,
  pageSize: 5,
};

describe('confirmed mock records', () => {
  it('registers once and restores the same record without duplicates', () => {
    const storage = memory();
    const store = new MockStore(storage, []);
    expect(store.register(record('one')).created).toBe(true);
    expect(store.register(record('one')).created).toBe(false);
    const reopened = new MockStore(storage, []);
    expect(reopened.history({ playerId: 'captain-1', page: 1, pageSize: 5 }).total).toBe(1);
    expect(reopened.ranking(filter).total).toBe(1);
  });
  it('orders by score and deterministic ties, with continuous paginated ranks', () => {
    const store = new MockStore(memory(), []);
    for (const [id, score] of [
      ['b', 8],
      ['a', 8],
      ['c', 7],
      ['d', 6],
      ['e', 5],
      ['f', 4],
    ] as const)
      store.register(record(id, score));
    expect(store.ranking(filter).items.map((item) => item.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(store.ranking({ ...filter, page: 2 }).items[0]?.rank).toBe(6);
  });
  it('filters ranking by balance and history by player', () => {
    const store = new MockStore(memory(), []);
    store.register(record('mine'));
    store.register(record('other', 8, 'captain-2'));
    const different = record('different');
    different.config.spawnSeconds = 2;
    different.configKey = configurationKey(different.config);
    store.register(different);
    expect(store.ranking(filter).total).toBe(2);
    expect(store.history({ playerId: 'captain-1', page: 1, pageSize: 5 }).total).toBe(2);
  });
  it('rejects an identifier reused for a different match payload', () => {
    const store = new MockStore(memory(), []);
    store.register(record('one'));
    expect(() => store.register(record('one', 99))).toThrow(/conflict/i);
  });
  it('isolates corrupt persisted records instead of breaking every list', () => {
    const storage = memory();
    const store = new MockStore(storage, []);
    store.register(record('valid'));
    storage.setItem('salt-and-trouble:confirmed:v1:corrupt', '{broken');
    expect(store.ranking(filter).total).toBe(1);
  });
  it('orders real completion instants correctly across time-zone offsets', () => {
    const store = new MockStore(memory(), []);
    store.register({ ...record('earlier'), completedAt: '2026-10-12T23:30:00.000Z' });
    store.register({ ...record('later'), completedAt: '2026-10-12T21:00:00-03:00' });
    expect(store.ranking(filter).items.map((item) => item.id)).toEqual(['earlier', 'later']);
    expect(
      store.history({ playerId: 'captain-1', page: 1, pageSize: 5 }).items.map((item) => item.id),
    ).toEqual(['later', 'earlier']);
  });
});
