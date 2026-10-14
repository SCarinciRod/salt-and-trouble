import { useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import { configurationKey } from '../data/contracts';
import { useHistory, useRanking } from '../data/queries';
import { makeGameConfig, type PlayerOptions } from '../game/config';
import { RecordsPanel } from './RecordsPanel';
import { network } from '../mocks/scenarios';

function Pagination({
  kind,
  page,
  total,
  pageSize,
  onPage,
}: {
  kind: 'ranking' | 'history';
  page: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav className="ledger-pagination" aria-label={`${kind} pagination`}>
      <button
        className="button button-outline compact-button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        aria-label={`Previous ${kind} page`}
      >
        ← Previous
      </button>
      <output aria-label={`${kind === 'ranking' ? 'Ranking' : 'History'} page`}>
        Page {page} of {pages}
      </output>
      <button
        className="button button-outline compact-button"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
        aria-label={`Next ${kind} page`}
      >
        Next →
      </button>
    </nav>
  );
}

function Ranking({ configKey }: { configKey: string }) {
  const [page, setPage] = useState(1);
  const query = useRanking(configKey, page);
  return (
    <RecordsPanel
      loading={query.isPending}
      refreshing={query.isFetching}
      failed={query.isError}
      hasData={!!query.data}
      onRetry={() => void query.refetch()}
    >
      {query.data &&
        (query.data.total === 0 ? (
          <div className="ledger-state">
            <h3>No captains on the board yet.</h3>
            <p>Finish a voyage and give the sea something to complain about.</p>
          </div>
        ) : (
          <>
            <table className="ledger-table" aria-label="Ranking">
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Captain</th>
                  <th scope="col">Score</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((entry) => (
                  <tr key={entry.id}>
                    <td className="rank-number">{String(entry.rank).padStart(2, '0')}</td>
                    <td>
                      <strong>{entry.playerName}</strong>
                      <small title={entry.playerId}>ID · {entry.playerId}</small>
                    </td>
                    <td className="ledger-score">{entry.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination kind="ranking" {...query.data} onPage={setPage} />
          </>
        ))}
    </RecordsPanel>
  );
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
function History({ playerId }: { playerId: string }) {
  const [page, setPage] = useState(1);
  const query = useHistory(playerId, page);
  return (
    <RecordsPanel
      loading={query.isPending}
      refreshing={query.isFetching}
      failed={query.isError}
      hasData={!!query.data}
      onRetry={() => void query.refetch()}
    >
      {query.data &&
        (query.data.total === 0 ? (
          <div className="ledger-state">
            <h3>No voyages logged yet.</h3>
            <p>Your reputation is still technically intact.</p>
          </div>
        ) : (
          <>
            <table className="ledger-table history-table" aria-label="Match History">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Score</th>
                  <th scope="col">Time at sea</th>
                  <th scope="col">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((entry) => (
                  <tr key={entry.id}>
                    <td data-label="Date">
                      <time dateTime={entry.completedAt}>
                        {dateFormatter.format(new Date(entry.completedAt))}
                      </time>
                      {entry.id.startsWith('fixture-history-') && <small>Demo voyage</small>}
                    </td>
                    <td data-label="Score" className="ledger-score">
                      {entry.score}
                    </td>
                    <td data-label="Time at sea">{Math.round(entry.playedSeconds)}s</td>
                    <td data-label="Outcome">
                      {entry.reason === 'death' ? 'Ship sunk' : 'Time elapsed'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination kind="history" {...query.data} onPage={setPage} />
          </>
        ))}
    </RecordsPanel>
  );
}

export function RecordsTabs({ options, playerId }: { options: PlayerOptions; playerId: string }) {
  const [active, setActive] = useState<'ranking' | 'history'>('ranking');
  const rankingButton = useRef<HTMLButtonElement>(null);
  const historyButton = useRef<HTMLButtonElement>(null);
  const configKey = configurationKey(makeGameConfig(options));
  const scenarioVersion = useSyncExternalStore(network.subscribe, network.getVersion, () => 0);
  function navigate(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === 'Home'
        ? 'ranking'
        : event.key === 'End'
          ? 'history'
          : active === 'ranking'
            ? 'history'
            : 'ranking';
    setActive(next);
    (next === 'ranking' ? rankingButton : historyButton).current?.focus();
  }
  return (
    <section className="captains-ledger" aria-labelledby="ledger-title">
      <div className="ledger-heading">
        <div>
          <span className="eyebrow">OFFICIAL RECORDS · UNOFFICIAL LEGENDS</span>
          <h2 id="ledger-title">The Captain’s Ledger</h2>
        </div>
        <span className="ledger-seal" aria-hidden="true">
          FILED
          <br />
          WITH REGRET
        </span>
      </div>
      <div className="ledger-tabs" role="tablist" aria-label="Captain records">
        <button
          ref={rankingButton}
          id="ranking-tab"
          role="tab"
          aria-selected={active === 'ranking'}
          aria-controls="ranking-panel"
          tabIndex={active === 'ranking' ? 0 : -1}
          onClick={() => setActive('ranking')}
          onKeyDown={navigate}
        >
          Ranking
        </button>
        <button
          ref={historyButton}
          id="history-tab"
          role="tab"
          aria-selected={active === 'history'}
          aria-controls="history-panel"
          tabIndex={active === 'history' ? 0 : -1}
          onClick={() => setActive('history')}
          onKeyDown={navigate}
        >
          Match History
        </button>
      </div>
      <div
        role="tabpanel"
        id={active === 'ranking' ? 'ranking-panel' : 'history-panel'}
        aria-labelledby={`${active}-tab`}
        tabIndex={0}
      >
        <p className="ledger-filter">
          {active === 'ranking'
            ? `Comparable voyages · ${options.sessionSeconds}s session · enemies every ${options.spawnSeconds}s · same gameplay settings`
            : 'Your confirmed voyages · newest first · dates in your local time zone'}
        </p>
        {active === 'ranking' ? (
          <Ranking key={`${scenarioVersion}:${configKey}`} configKey={configKey} />
        ) : (
          <History key={scenarioVersion} playerId={playerId} />
        )}
      </div>
    </section>
  );
}
