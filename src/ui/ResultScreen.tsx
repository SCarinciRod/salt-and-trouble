import type { MatchResult } from '../game/types';
import type { RegistrationState } from '../data/queries';
import { RegistrationStatus } from './RegistrationStatus';

export function ResultScreen({
  result,
  onPlay,
  onMenu,
  storageWarning,
  onRetryStorage,
  registration,
  serviceReady,
  onRetryRegistration,
}: {
  result: MatchResult;
  onPlay: () => void;
  onMenu: () => void;
  storageWarning: boolean;
  onRetryStorage: () => void;
  registration: RegistrationState;
  serviceReady: boolean;
  onRetryRegistration: () => void;
}) {
  return (
    <main className="result-shell">
      <span className="eyebrow">THE CAPTAIN'S INCIDENT REPORT</span>
      <div className="result-emblem" aria-hidden="true">
        ⚓
      </div>
      <h1>{result.reason === 'death' ? 'A boat-shaped mistake.' : 'Still floating. Somehow.'}</h1>
      <p>
        {result.reason === 'death'
          ? 'The ship is now a very expensive submarine.'
          : 'Your crew would like to renegotiate their contracts.'}
      </p>
      <div className="result-stats">
        <div>
          <span>FINAL SCORE</span>
          <strong>{result.score}</strong>
        </div>
        <div>
          <span>TIME AT SEA</span>
          <strong>
            {Math.round(result.playedSeconds)}
            <small>s</small>
          </strong>
        </div>
        <div>
          <span>END OF VOYAGE</span>
          <strong className="result-reason">
            {result.reason === 'death' ? 'Ship sunk' : 'Time elapsed'}
          </strong>
        </div>
      </div>
      {storageWarning && (
        <div className="storage-warning" role="alert">
          <p>
            Browser storage is unavailable. Your reports are held in this tab until confirmed and
            may be lost on refresh.
          </p>
          <button className="text-button" onClick={onRetryStorage}>
            Retry saving reports
          </button>
        </div>
      )}
      <RegistrationStatus state={registration} ready={serviceReady} onRetry={onRetryRegistration} />
      <div className="hero-actions">
        <button className="button button-coral" onClick={onPlay}>
          Play Again <span aria-hidden="true">↗</span>
        </button>
        <button className="button button-outline" onClick={onMenu}>
          Main Menu
        </button>
      </div>
      <p className="result-footnote">
        THE OCEAN ACCEPTS NO LIABILITY. ESPECIALLY FOR THAT LAST MANEUVER.
      </p>
    </main>
  );
}
