import type { RegistrationState } from '../data/queries';

export function RegistrationStatus({
  state,
  ready,
  onRetry,
}: {
  state: RegistrationState;
  ready: boolean;
  onRetry: () => void;
}) {
  return (
    <div
      className={`submission-status registration-${state.status}`}
      role="status"
      aria-label="Match registration"
    >
      <p>
        {state.status === 'saved'
          ? 'Saved — the harbor office has filed your incident report.'
          : state.status === 'submitting'
            ? 'Submitting your incident report…'
            : 'Pending — your incident report has not been confirmed.'}
      </p>
      {state.message && <p>{state.message}</p>}
      {state.status === 'pending' && (
        <button className="text-button" onClick={onRetry} disabled={!ready}>
          Retry registration
        </button>
      )}
    </div>
  );
}
