export const SCENARIOS = [
  { id: 'success', label: 'Success', description: 'Normal responses and other captain fixtures.' },
  {
    id: 'empty',
    label: 'Empty fixtures',
    description: 'No fixture rows; your confirmed matches remain visible.',
  },
  {
    id: 'multiple-pages',
    label: 'Multiple pages',
    description: 'Adds illustrative history for this captain.',
  },
  { id: 'slow', label: 'Slow responses', description: 'Fixed 800 ms latency.' },
  {
    id: 'variable-latency',
    label: 'Variable latency',
    description: 'A repeatable 90/700/140/450 ms sequence.',
  },
  {
    id: 'out-of-order',
    label: 'Out-of-order responses',
    description: 'Alternating old slow and newer fast responses.',
  },
  { id: 'timeout', label: 'Timeout', description: 'Responses exceed the HTTP client timeout.' },
  {
    id: 'offline',
    label: 'Connection failure',
    description: 'All data requests fail without affecting gameplay.',
  },
  { id: 'http-400', label: 'HTTP 400', description: 'A non-retryable request failure.' },
  { id: 'http-500', label: 'HTTP 500', description: 'A transient server failure.' },
  { id: 'ranking-error', label: 'Ranking failure', description: 'Only ranking queries fail.' },
  { id: 'history-error', label: 'History failure', description: 'Only history queries fail.' },
  {
    id: 'registration-error',
    label: 'Registration failure',
    description: 'Only completed match submission fails.',
  },
  {
    id: 'write-timeout',
    label: 'Timeout after recording',
    description: 'The first POST is saved, but its response is lost; retry recovers it.',
  },
] as const;
export type Scenario = (typeof SCENARIOS)[number]['id'];
export const SCENARIO_KEY = 'salt-and-trouble:network:v1';
const validScenario = (value: unknown): value is Scenario =>
  SCENARIOS.some((scenario) => scenario.id === value);

export class ScenarioController {
  mode: Scenario;
  version = 0;
  private readonly counts = new Map<string, number>();
  private readonly listeners = new Set<() => void>();

  constructor(
    mode: Scenario = 'success',
    readonly latencyScale = 1,
  ) {
    this.mode = mode;
  }
  set(mode: Scenario) {
    this.mode = mode;
    this.version++;
    this.counts.clear();
    for (const listener of this.listeners) listener();
  }
  ticket(resource: string) {
    const count = (this.counts.get(resource) ?? 0) + 1;
    this.counts.set(resource, count);
    return { mode: this.mode, count, version: this.version };
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getVersion = () => this.version;
}

function initialScenario(): Scenario {
  try {
    const fromUrl = new URLSearchParams(location.search).get('network');
    const stored = localStorage.getItem(SCENARIO_KEY);
    return validScenario(fromUrl) ? fromUrl : validScenario(stored) ? stored : 'success';
  } catch {
    return 'success';
  }
}
export const network = new ScenarioController(initialScenario());

export function selectScenario(mode: Scenario) {
  network.set(mode);
  try {
    localStorage.setItem(SCENARIO_KEY, mode);
    const url = new URL(location.href);
    if (mode === 'success') url.searchParams.delete('network');
    else url.searchParams.set('network', mode);
    history.replaceState(null, '', url);
  } catch {
    /* The current session scenario remains selectable without storage. */
  }
}

export function resetDemo() {
  const prefixes = [
    'salt-and-trouble:confirmed:',
    'salt-and-trouble:outbox:',
    'salt-and-trouble:receipt:',
  ];
  const keys = Object.keys(localStorage).filter(
    (key) =>
      prefixes.some((prefix) => key.startsWith(prefix)) || key === 'salt-and-trouble:result:v1',
  );
  for (const key of keys) localStorage.removeItem(key);
  selectScenario('success');
  location.reload();
}
