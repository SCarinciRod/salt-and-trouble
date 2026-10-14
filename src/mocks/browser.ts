import { setupWorker } from 'msw/browser';
import { getPlayerId } from '../storage/results';
import { makeFixtures } from './fixtures';
import { createHandlers } from './handlers';
import { network } from './scenarios';
import { MockStore, type MockStorage } from './store';

function storage(): MockStorage {
  try {
    return localStorage;
  } catch {
    return {
      getItem: () => {
        throw new Error('Storage unavailable');
      },
      setItem: () => {
        throw new Error('Storage unavailable');
      },
      removeItem: () => {
        throw new Error('Storage unavailable');
      },
      key: () => null,
      length: 0,
    };
  }
}
const store = new MockStore(storage(), makeFixtures(getPlayerId()));
const worker = setupWorker(...createHandlers(store, network));
let starting: Promise<void> | undefined;
export function startMocks(): Promise<void> {
  if (!starting) {
    starting = worker
      .start({
        quiet: true,
        onUnhandledRequest: 'bypass',
        serviceWorker: { url: '/mockServiceWorker.js' },
      })
      .then(() => undefined)
      .catch((error: unknown) => {
        worker.stop();
        starting = undefined;
        throw error;
      });
  }
  return starting;
}
