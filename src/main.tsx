import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DataServicesContext, type DataServices } from './data/services';

const root = createRoot(document.getElementById('root')!);
const queryClient = new QueryClient();
let state: DataServices = {
  ready: false,
  starting: true,
  error: '',
  retry: () => {
    void start();
  },
};

function render() {
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <DataServicesContext.Provider value={state}>
          <App />
        </DataServicesContext.Provider>
      </QueryClientProvider>
    </StrictMode>,
  );
}

async function start() {
  state = { ...state, starting: true, error: '' };
  render();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  try {
    const service = import('./mocks/browser').then(({ startMocks }) => startMocks());
    await Promise.race([
      service,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          reject(new Error('Data service startup timed out'));
        }, 10_000);
      }),
    ]);
    state = { ...state, ready: true, starting: false };
  } catch {
    // Native worker registration has no cancellation API. A fresh document safely
    // discards a hung initialization instead of racing another worker in this page.
    state = {
      ...state,
      ready: false,
      starting: false,
      error: `The demo data service could not start. Play and Options are still available.${timedOut ? ' Retrying will reload this page.' : ''}`,
      retry: timedOut
        ? () => location.reload()
        : () => {
            void start();
          },
    };
  } finally {
    clearTimeout(timer);
    render();
  }
}
void start();
