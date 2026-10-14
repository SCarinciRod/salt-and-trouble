import { useCallback, useState } from 'react';
import { makeGameConfig, type GameConfig, type PlayerOptions } from './game/config';
import { loadOptions, saveOptions } from './storage/settings';
import { MainMenu } from './ui/MainMenu';
import { OptionsForm } from './ui/OptionsForm';
import { GameScreen } from './ui/GameScreen';
import { ResultScreen } from './ui/ResultScreen';
import {
  addPending,
  getPlayerId,
  loadLastResult,
  persistPending,
  saveLastResult,
} from './storage/results';
import type { Simulation } from './game/simulation/world';
import type { MatchResult } from './game/types';
import { useMatchSubmission } from './data/queries';
import { RecordsTabs } from './ui/RecordsTabs';
import { NetworkLab } from './ui/NetworkLab';
import './styles.css';

export function App() {
  const [options, setOptions] = useState(loadOptions);
  const [showOptions, setShowOptions] = useState(false);
  const [screen, setScreen] = useState<'menu' | 'game' | 'result'>('menu');
  const [result, setResult] = useState(loadLastResult);
  const [match, setMatch] = useState<{ id: string; config: GameConfig } | null>(null);
  const [storageWarning, setStorageWarning] = useState(false);
  const [playerId] = useState(getPlayerId);
  const submission = useMatchSubmission();

  function play() {
    setMatch({ id: crypto.randomUUID(), config: makeGameConfig(options) });
    setScreen('game');
  }

  const finish = useCallback(
    (world: Simulation) => {
      if (!match || !world.reason) return;
      const completed: MatchResult = {
        id: match.id,
        playerId,
        playerName: 'Captain Bad Idea',
        completedAt: new Date().toISOString(),
        score: world.score,
        playedSeconds: world.elapsed,
        reason: world.reason,
        config: world.config,
      };
      const resultSaved = saveLastResult(completed);
      const pendingSaved = addPending(completed);
      setStorageWarning(!resultSaved || !pendingSaved);
      setResult(completed);
      setScreen('result');
    },
    [match, playerId],
  );

  function retryPersistence() {
    const pendingSaved = persistPending();
    const resultSaved = result ? saveLastResult(result) : true;
    setStorageWarning(!pendingSaved || !resultSaved);
  }

  function applyOptions(next: PlayerOptions) {
    setOptions(next);
    return saveOptions(next);
  }

  if (screen === 'game' && match)
    return (
      <GameScreen
        key={match.id}
        config={match.config}
        onFinish={finish}
        onExit={() => setScreen('menu')}
      />
    );
  if (screen === 'result' && result)
    return (
      <ResultScreen
        result={result}
        onPlay={play}
        onMenu={() => setScreen('menu')}
        storageWarning={storageWarning}
        onRetryStorage={retryPersistence}
        registration={submission.stateFor(result.id)}
        serviceReady={submission.serviceReady}
        onRetryRegistration={() => submission.retry(result.id)}
      />
    );

  return (
    <>
      <MainMenu options={options} onOptions={() => setShowOptions(true)} onPlay={play}>
        {result && (
          <div className="last-voyage">
            <span>
              LAST VOYAGE: {result.score} POINTS ·{' '}
              {result.reason === 'death' ? 'UNPLANNED DIVING EXPEDITION' : 'STILL FLOATING'}
            </span>
            <button className="text-button" onClick={() => setScreen('result')}>
              Last voyage <span aria-hidden="true">↗</span>
            </button>
          </div>
        )}
        {submission.pendingCount > 0 && (
          <div className="pending-reports" role="status">
            <span>
              {submission.pendingCount} pending incident{' '}
              {submission.pendingCount === 1 ? 'report' : 'reports'}. You can start another voyage.
            </span>
            <button
              className="text-button"
              disabled={!submission.serviceReady}
              onClick={() => submission.retry()}
            >
              Retry pending reports
            </button>
          </div>
        )}
        <RecordsTabs options={options} playerId={playerId} />
        <NetworkLab />
      </MainMenu>
      {showOptions && (
        <OptionsForm
          options={options}
          onSave={applyOptions}
          onClose={() => setShowOptions(false)}
        />
      )}
    </>
  );
}
