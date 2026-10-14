import { useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { network, resetDemo, SCENARIOS, selectScenario, type Scenario } from '../mocks/scenarios';

export function NetworkLab() {
  useSyncExternalStore(network.subscribe, network.getVersion, () => 0);
  const client = useQueryClient();
  const [error, setError] = useState('');
  async function select(mode: Scenario) {
    await client.cancelQueries({
      predicate: (query) => ['ranking', 'history'].includes(String(query.queryKey[0])),
    });
    selectScenario(mode);
    await client.invalidateQueries({
      predicate: (query) => ['ranking', 'history'].includes(String(query.queryKey[0])),
    });
  }
  function reset() {
    try {
      resetDemo();
    } catch {
      setError('Browser storage is unavailable. The demo records could not be reset.');
    }
  }
  return (
    <details className="network-lab">
      <summary>Network conditions</summary>
      <p>
        Try the mock harbor office under rough seas. These scenarios affect records; your ship keeps
        sailing.
      </p>
      <div className="network-controls">
        <label htmlFor="network-scenario">Network scenario</label>
        <select
          id="network-scenario"
          value={network.mode}
          onChange={(event) => void select(event.target.value as Scenario)}
        >
          {SCENARIOS.map((scenario) => (
            <option key={scenario.id} value={scenario.id}>
              {scenario.label}
            </option>
          ))}
        </select>
        <button className="text-button" onClick={reset}>
          Reset demo records
        </button>
      </div>
      <p className="scenario-description">
        {SCENARIOS.find((scenario) => scenario.id === network.mode)?.description} Multiple pages
        includes example voyages labeled “Demo voyage”. Reset removes confirmed reports, pending
        reports and the last voyage on this device; options and captain identity stay saved.
      </p>
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
