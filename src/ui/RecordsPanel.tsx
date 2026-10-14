import type { ReactNode } from 'react';
import { useDataServices } from '../data/services';

export function RecordsPanel({
  loading,
  refreshing,
  failed,
  hasData,
  onRetry,
  children,
}: {
  loading: boolean;
  refreshing: boolean;
  failed: boolean;
  hasData: boolean;
  onRetry: () => void;
  children: ReactNode;
}) {
  const services = useDataServices();
  if (!services.ready)
    return (
      <div className="ledger-state" role="status">
        {services.starting ? (
          'Opening the harbor office…'
        ) : (
          <>
            <p>{services.error}</p>
            <button className="button button-outline compact-button" onClick={services.retry}>
              Retry data service
            </button>
          </>
        )}
      </div>
    );
  if (loading)
    return (
      <div className="ledger-state" role="status">
        Fetching the captain’s paperwork…
      </div>
    );
  if (failed && !hasData)
    return (
      <div className="ledger-state" role="alert">
        <p>The harbor office could not load these records.</p>
        <button className="button button-outline compact-button" onClick={onRetry}>
          Retry records
        </button>
      </div>
    );
  return (
    <>
      <div className="ledger-refresh" role="status">
        {refreshing ? (
          'Refreshing records…'
        ) : failed ? (
          <>
            <span>Refresh failed. These are the last confirmed records. </span>
            <button className="text-button" onClick={onRetry}>
              Retry records
            </button>
          </>
        ) : (
          'Records are up to date.'
        )}
      </div>
      {children}
    </>
  );
}
