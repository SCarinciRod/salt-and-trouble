import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { createHandlers } from '../mocks/handlers';
import { MockStore } from '../mocks/store';
import { ScenarioController } from '../mocks/scenarios';
import { api, httpClient } from './api';
import { configurationKey } from './contracts';
import { DEFAULT_OPTIONS, makeGameConfig } from '../game/config';

const server = setupServer();
let store: MockStore;
let scenarios: ScenarioController;
const result = {
  id: 'http-match',
  playerId: 'http-player',
  playerName: 'Captain Bad Idea',
  completedAt: '2026-10-12T23:00:00.000Z',
  score: 5,
  playedSeconds: 120,
  reason: 'time' as const,
  config: makeGameConfig(DEFAULT_OPTIONS),
};
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
beforeEach(() => {
  const values = new Map<string, string>();
  store = new MockStore(
    {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
      key: (i) => [...values.keys()][i] ?? null,
      get length() {
        return values.size;
      },
    },
    [],
  );
  scenarios = new ScenarioController('success', 0.01);
  server.use(...createHandlers(store, scenarios));
  httpClient.defaults.baseURL = 'http://localhost/api';
  httpClient.defaults.timeout = 1200;
});

it('uses real HTTP to register once and refresh both data views', async () => {
  const first = await api.register(result);
  const again = await api.register(result);
  expect(first.id).toBe(again.id);
  const history = await api.history({ playerId: result.playerId, page: 1, pageSize: 5 });
  const ranking = await api.ranking({
    configKey: configurationKey(result.config),
    page: 1,
    pageSize: 5,
  });
  expect(history.total).toBe(1);
  expect(ranking.total).toBe(1);
  expect(ranking.items[0]?.rank).toBe(1);
});

it('recovers a POST timeout after the write without duplication', async () => {
  scenarios.set('write-timeout');
  httpClient.defaults.timeout = 10;
  await expect(api.register(result)).rejects.toThrow();
  httpClient.defaults.timeout = 1200;
  const recovered = await api.register(result);
  expect(recovered.id).toBe(result.id);
  expect(store.history({ playerId: result.playerId, page: 1, pageSize: 5 }).total).toBe(1);
});

it('supports separate ranking failure and an unaffected history query', async () => {
  scenarios.set('ranking-error');
  await expect(
    api.ranking({ configKey: configurationKey(result.config), page: 1, pageSize: 5 }),
  ).rejects.toThrow();
  expect((await api.history({ playerId: result.playerId, page: 1, pageSize: 5 })).total).toBe(0);
});

it('rejects invalid submitted records through the network contract', async () => {
  await expect(api.register({ ...result, score: -1 })).rejects.toThrow();
});

it('rejects a valid-looking confirmation whose score was changed', async () => {
  server.use(
    http.post('http://localhost/api/matches', () => HttpResponse.json({ ...result, score: 500 })),
  );
  await expect(api.register(result)).rejects.toThrow(/confirmation/i);
});

it('rejects a history page for another captain', async () => {
  server.use(
    http.get('http://localhost/api/matches', () =>
      HttpResponse.json({
        items: [{ ...result, playerId: 'someone-else' }],
        page: 1,
        pageSize: 5,
        total: 1,
      }),
    ),
  );
  await expect(api.history({ playerId: result.playerId, page: 1, pageSize: 5 })).rejects.toThrow(
    /page/i,
  );
});

it('rejects mismatched pagination metadata', async () => {
  server.use(
    http.get('http://localhost/api/matches', () =>
      HttpResponse.json({ items: [], page: 2, pageSize: 5, total: 0 }),
    ),
  );
  await expect(api.history({ playerId: result.playerId, page: 1, pageSize: 5 })).rejects.toThrow(
    /page/i,
  );
});

it('returns the exact status advertised by the HTTP 500 scenario', async () => {
  scenarios.set('http-500');
  await expect(
    api.ranking({ configKey: configurationKey(result.config), page: 1, pageSize: 5 }),
  ).rejects.toMatchObject({ response: { status: 500 } });
});
