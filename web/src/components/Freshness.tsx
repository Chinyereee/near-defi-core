import { age } from '../format';

export type FreshState = 'live' | 'stale' | 'loading' | 'error' | 'idle';

/** Route Lab's quote-freshness line: dot + mono status, optional retry. */
export function Freshness({
  state,
  label,
  updatedAt,
  now,
  onRetry,
}: {
  state: FreshState;
  label?: string;
  updatedAt?: string | null;
  now: number;
  onRetry?: () => void;
}) {
  const text =
    label ??
    (state === 'live'
      ? `LIVE · updated ${age(updatedAt, now)}`
      : state === 'stale'
        ? `STALE · last good ${age(updatedAt, now)}`
        : state === 'loading'
          ? 'FETCHING'
          : state === 'error'
            ? 'UNAVAILABLE'
            : 'WAITING');
  return (
    <div className={`fresh fresh-${state}`} role={state === 'error' ? 'alert' : 'status'}>
      <span className="fresh-dot" aria-hidden="true" />
      <span className="fresh-text">{text}</span>
      {onRetry && state === 'error' && (
        <button className="fresh-retry" type="button" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

/** Feed state from server status + age; anything older than 90s reads as stale. */
export function feedState(status: string | undefined, updatedAt: string | null | undefined, now: number): FreshState {
  if (status === 'OFFLINE' || !updatedAt) return 'error';
  if (status === 'STALE' || now - Date.parse(updatedAt) > 90_000) return 'stale';
  return 'live';
}
