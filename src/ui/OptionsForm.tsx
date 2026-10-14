import { useEffect, useRef, useState } from 'react';
import { OPTION_LIMITS, validateOptions, type PlayerOptions } from '../game/config';

interface OptionsFormProps {
  options: PlayerOptions;
  onSave: (options: PlayerOptions) => boolean;
  onClose: () => void;
}

export function OptionsForm({ options, onSave, onClose }: OptionsFormProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [duration, setDuration] = useState(String(options.sessionSeconds));
  const [spawn, setSpawn] = useState(String(options.spawnSeconds));
  const [errors, setErrors] = useState<Partial<Record<keyof PlayerOptions, string>>>({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = {
      sessionSeconds: duration.trim() ? Number(duration) : NaN,
      spawnSeconds: spawn.trim() ? Number(spawn) : NaN,
    };
    const validation = validateOptions(next);
    setErrors(validation);
    if (Object.keys(validation).length) {
      setMessage('');
      return;
    }
    setMessage(
      onSave(next)
        ? 'Options saved. Your next voyage is suitably ill-advised.'
        : 'Options applied for this visit. Browser storage is unavailable.',
    );
  }

  return (
    <dialog
      ref={dialog}
      className="options-dialog"
      aria-labelledby="options-title"
      onCancel={onClose}
    >
      <div className="dialog-top">
        <span className="eyebrow">THE CAPTAIN'S FINE PRINT</span>
        <button type="button" className="icon-button" aria-label="Close options" onClick={onClose}>
          ×
        </button>
      </div>
      <h2 id="options-title">Options</h2>
      <p>Adjust the odds. Blame the ocean anyway.</p>
      <form onSubmit={submit} noValidate>
        <label htmlFor="session-time">
          Game session time <span>SECONDS</span>
        </label>
        <input
          id="session-time"
          type="number"
          min={OPTION_LIMITS.sessionSeconds.min}
          max={OPTION_LIMITS.sessionSeconds.max}
          step="1"
          value={duration}
          onChange={(event) => setDuration(event.target.value)}
          aria-invalid={!!errors.sessionSeconds}
          aria-describedby="session-help"
        />
        <small id="session-help">60–180 seconds. How long can your luck hold?</small>
        <label htmlFor="spawn-time">
          Enemy spawn time <span>SECONDS</span>
        </label>
        <input
          id="spawn-time"
          type="number"
          min={OPTION_LIMITS.spawnSeconds.min}
          max={OPTION_LIMITS.spawnSeconds.max}
          step="0.5"
          value={spawn}
          onChange={(event) => setSpawn(event.target.value)}
          aria-invalid={!!errors.spawnSeconds}
          aria-describedby="spawn-help"
        />
        <small id="spawn-help">0.5–15 seconds between arrivals. They weren't invited.</small>
        {Object.keys(errors).length > 0 && (
          <div role="alert" className="form-errors">
            {Object.values(errors).map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        )}
        <p role="status" className="save-message">
          {message}
        </p>
        <button className="button button-coral" type="submit">
          Save options <span aria-hidden="true">↗</span>
        </button>
      </form>
    </dialog>
  );
}
