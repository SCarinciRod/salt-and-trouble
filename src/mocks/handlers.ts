import { delay, http, HttpResponse } from 'msw';
import { parseMatchRecord } from '../data/contracts';
import { StoreError, type FixtureMode, type MockStore } from './store';
import type { ScenarioController } from './scenarios';

type Ticket = ReturnType<ScenarioController['ticket']>;
const fixtureMode = (ticket: Ticket): FixtureMode =>
  ticket.mode === 'empty' ? 'none' : ticket.mode === 'multiple-pages' ? 'all' : 'standard';

function pageParams(url: URL) {
  const page = Number(url.searchParams.get('page') ?? 1);
  const pageSize = Number(url.searchParams.get('pageSize') ?? 5);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 50
  )
    throw new StoreError('Invalid pagination parameters', 400);
  return { page, pageSize };
}

async function responseDelay(ticket: Ticket, controller: ScenarioController) {
  const duration =
    ticket.mode === 'slow'
      ? 800
      : ticket.mode === 'timeout'
        ? 2200
        : ticket.mode === 'variable-latency'
          ? [90, 700, 140, 450][(ticket.count - 1) % 4]!
          : ticket.mode === 'out-of-order'
            ? ticket.count % 2 === 1
              ? 1000
              : 70
            : 80;
  await delay(duration * controller.latencyScale);
}
function failure(ticket: Ticket, resource: 'ranking' | 'history' | 'registration') {
  if (ticket.mode === 'offline') return HttpResponse.error();
  if (ticket.mode === 'http-400')
    return HttpResponse.json({ message: 'Simulated invalid request' }, { status: 400 });
  if (ticket.mode === 'http-500' || ticket.mode === `${resource}-error`)
    return HttpResponse.json(
      { message: 'The harbor office is temporarily unavailable' },
      { status: ticket.mode === 'http-500' ? 500 : 503 },
    );
  return null;
}
function errorResponse(error: unknown) {
  return HttpResponse.json(
    { message: error instanceof Error ? error.message : 'Could not process match data' },
    { status: error instanceof StoreError ? error.status : 400 },
  );
}

export function createHandlers(store: MockStore, scenarios: ScenarioController) {
  return [
    http.get('*/api/ranking', async ({ request }) => {
      const ticket = scenarios.ticket('ranking');
      try {
        const url = new URL(request.url);
        const configKey = url.searchParams.get('configKey');
        if (!configKey) throw new StoreError('A configuration key is required', 400);
        const snapshot = store.ranking({ configKey, ...pageParams(url) }, fixtureMode(ticket));
        await responseDelay(ticket, scenarios);
        return failure(ticket, 'ranking') ?? HttpResponse.json(snapshot);
      } catch (error) {
        return errorResponse(error);
      }
    }),
    http.get('*/api/matches', async ({ request }) => {
      const ticket = scenarios.ticket('history');
      try {
        const url = new URL(request.url);
        const playerId = url.searchParams.get('playerId');
        if (!playerId) throw new StoreError('A player identifier is required', 400);
        const snapshot = store.history({ playerId, ...pageParams(url) }, fixtureMode(ticket));
        await responseDelay(ticket, scenarios);
        return failure(ticket, 'history') ?? HttpResponse.json(snapshot);
      } catch (error) {
        return errorResponse(error);
      }
    }),
    http.post('*/api/matches', async ({ request }) => {
      const ticket = scenarios.ticket('registration');
      try {
        const record = parseMatchRecord(await request.json());
        if (!record) throw new StoreError('Invalid completed match record', 400);
        if (ticket.mode === 'write-timeout') {
          const outcome = await lockedRegistration(store, record);
          if (outcome.created) await delay(2200 * scenarios.latencyScale);
          return HttpResponse.json(outcome.record, { status: outcome.created ? 201 : 200 });
        }
        await responseDelay(ticket, scenarios);
        const failed = failure(ticket, 'registration');
        if (failed) return failed;
        if (ticket.version !== scenarios.version)
          throw new StoreError('Network scenario changed; retry this report', 409);
        const outcome = await lockedRegistration(store, record);
        return HttpResponse.json(outcome.record, { status: outcome.created ? 201 : 200 });
      } catch (error) {
        return errorResponse(error);
      }
    }),
  ];
}

async function lockedRegistration(
  store: MockStore,
  record: NonNullable<ReturnType<typeof parseMatchRecord>>,
) {
  if (typeof navigator !== 'undefined' && navigator.locks)
    return navigator.locks.request(`salt-and-trouble:match:${record.id}`, () =>
      store.register(record),
    );
  return store.register(record);
}
