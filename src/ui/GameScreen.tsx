import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameConfig } from '../game/config';
import type { RuntimeHandle } from '../game/rendering/runtime';
import type { Simulation } from '../game/simulation/world';
import type { Action, HudSnapshot } from '../game/types';
import { GameCanvas } from './GameCanvas';
import { TutorialDialog } from './TutorialDialog';

interface GameScreenProps {
  config: GameConfig;
  onFinish: (world: Simulation) => void;
  onExit: () => void;
}

function PauseDialog({ onResume, onExit }: { onResume: () => void; onExit: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="options-dialog pause-dialog"
      aria-labelledby="pause-title"
      onCancel={(event) => event.preventDefault()}
    >
      <span className="eyebrow">THE OCEAN CAN WAIT</span>
      <h2 id="pause-title">Pause the panic</h2>
      <p>Your crew is pretending this was part of the plan.</p>
      <button className="button button-coral" onClick={onResume}>
        Resume voyage <span aria-hidden="true">↗</span>
      </button>
      <button className="button button-outline dark-outline" onClick={onExit}>
        Main Menu
      </button>
      <small>Returning to port abandons this match.</small>
    </dialog>
  );
}

export function GameScreen({ config, onFinish, onExit }: GameScreenProps) {
  const runtime = useRef<RuntimeHandle | null>(null);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [showTutorial, setShowTutorial] = useState(true);
  const onReady = useCallback((handle: RuntimeHandle | null) => {
    runtime.current = handle;
  }, []);
  const dismissTutorial = useCallback(() => {
    runtime.current?.resume();
    setShowTutorial(false);
  }, []);
  const buttons: { action: Action; label: string; icon: string }[] = [
    { action: 'left', label: 'Turn left', icon: '↶' },
    { action: 'forward', label: 'Move forward', icon: '↑' },
    { action: 'right', label: 'Turn right', icon: '↷' },
    { action: 'port', label: 'Fire left broadside', icon: 'Q' },
    { action: 'front', label: 'Fire front cannon', icon: '●' },
    { action: 'starboard', label: 'Fire right broadside', icon: 'E' },
  ];
  return (
    <main className="game-shell">
      <header className="game-header">
        <span className="wordmark">
          <span className="brand-emblem" aria-hidden="true">
            ⚓
          </span>{' '}
          SALT & TROUBLE
        </span>
        <span className="game-location">THE SEA OF POOR DECISIONS</span>
        <button
          className="button button-outline compact-button"
          onClick={() => runtime.current?.pause()}
          disabled={!hud}
        >
          Pause
        </button>
      </header>
      <section className="game-hud" aria-label="Match information">
        <div>
          <span>HULL / YOUR LAST GOOD IDEA</span>
          <output aria-label="Player health">
            {hud?.hp ?? config.player.maxHp}
            <small> / {config.player.maxHp}</small>
          </output>
        </div>
        <div>
          <span>ENEMIES GIVEN SWIMMING LESSONS</span>
          <output aria-label="Score">{hud?.score ?? 0}</output>
        </div>
        <div>
          <span>TIME UNTIL THE PAPERWORK</span>
          <output aria-label="Time remaining">{hud?.remaining ?? config.sessionSeconds}s</output>
        </div>
        <output className="match-status" aria-label="Match status">
          {hud
            ? hud.status === 'running'
              ? 'Running'
              : hud.status === 'paused'
                ? 'Paused'
                : 'Finished'
            : 'Loading'}
        </output>
      </section>
      <GameCanvas config={config} onHud={setHud} onFinish={onFinish} onReady={onReady} />
      <div className="combat-controls" aria-label="Touch controls">
        {buttons.map(({ action, label, icon }) => (
          <button
            key={action}
            className={`touch-button ${action === 'front' ? 'touch-fire' : ''}`}
            aria-label={label}
            disabled={!hud || hud.status !== 'running'}
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              runtime.current?.setTouch(action, true);
            }}
            onPointerUp={() => runtime.current?.setTouch(action, false)}
            onPointerCancel={() => runtime.current?.setTouch(action, false)}
            onLostPointerCapture={() => runtime.current?.setTouch(action, false)}
          >
            <span aria-hidden="true">{icon}</span>
            <small>{label}</small>
          </button>
        ))}
      </div>
      <p className="combat-hint">
        W / A / D to sail · Space: front cannon · Left / right mouse: broadsides · Esc to pause{' '}
        <span>Islands are not shortcuts. We checked.</span>
      </p>
      {hud && showTutorial && <TutorialDialog onDismiss={dismissTutorial} />}
      {hud?.status === 'paused' && !showTutorial && (
        <PauseDialog onResume={() => runtime.current?.resume()} onExit={onExit} />
      )}
    </main>
  );
}
