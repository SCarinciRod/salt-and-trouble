import { useEffect, useRef, useState } from 'react';
import type { GameConfig } from '../game/config';
import { createRuntime, type RuntimeHandle } from '../game/rendering/runtime';
import type { HudSnapshot } from '../game/types';
import type { Simulation } from '../game/simulation/world';

interface GameCanvasProps {
  config: GameConfig;
  onHud: (hud: HudSnapshot) => void;
  onFinish: (world: Simulation) => void;
  onReady: (handle: RuntimeHandle | null) => void;
}

export function GameCanvas({ config, onHud, onFinish, onReady }: GameCanvasProps) {
  const host = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let runtime: RuntimeHandle | null = null;
    const element = host.current!;
    createRuntime(element, config, {
      onProgress: setProgress,
      onHud,
      onFinish,
      signal: controller.signal,
    })
      .then((handle) => {
        if (controller.signal.aborted) {
          handle?.destroy();
          return;
        }
        runtime = handle;
        onReady(handle);
        setReady(!!handle);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('The cargo went overboard. We could not load the arena.');
      });
    return () => {
      controller.abort();
      runtime?.destroy();
      onReady(null);
    };
  }, [config, onHud, onFinish, onReady, attempt]);

  return (
    <div className="arena-frame">
      <div className="canvas-host" ref={host} />
      {!ready && (
        <div className="asset-overlay">
          {error ? (
            <>
              <p role="alert">{error}</p>
              <button
                className="button button-coral"
                onClick={() => {
                  setError('');
                  setProgress(0);
                  setAttempt((value) => value + 1);
                }}
              >
                Retry loading
              </button>
            </>
          ) : (
            <>
              <span className="eyebrow">LOADING THE QUESTIONABLE CARGO</span>
              <p role="status">Preparing the sea… {progress}%</p>
              <progress max="100" value={progress} aria-label="Asset loading progress" />
            </>
          )}
        </div>
      )}
    </div>
  );
}
