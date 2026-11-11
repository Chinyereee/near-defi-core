import type { ChainKey, StateResponse } from '../types';
import { CHAIN_MARK, fmtAmount, fmtUsd, shortAddr } from '../format';
import { Freshness, feedState } from './Freshness';

export function ChainCard({
  chain,
  index,
  state,
  now,
  onRetry,
}: {
  chain: ChainKey;
  index: number;
  state: StateResponse;
  now: number;
  onRetry: () => void;
}) {
  const meta = state.chains[chain];
  const bal = state.balances.chains[chain];
  const gas = state.gas[chain];
  const fresh = feedState(bal?.status, bal?.updatedAt, now);
  const holdings = [...(bal?.holdings ?? [])].sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1));

  return (
    <article className="card chain-card">
      <div className="card-heading">
        <div>
          <p className="caption">CHAIN 0{index + 1}</p>
          <h3>{meta.name}</h3>
          <p className="muted small">
            Chain {meta.chainId} · gas in {meta.nativeSymbol}
          </p>
        </div>
        <span className="chain-mark" aria-hidden="true">{CHAIN_MARK[chain]}</span>
      </div>

      <Freshness
        state={fresh}
        updatedAt={bal?.updatedAt}
        now={now}
        label={fresh === 'error' ? `OFFLINE · ${bal?.error ?? 'RPC unreachable'}` : undefined}
        onRetry={onRetry}
      />

      <div className="chain-total">
        <span>Balance</span>
        <strong>{bal?.status === 'OFFLINE' ? '—' : fmtUsd(bal?.totalUsd ?? 0)}</strong>
      </div>

      <div className="metrics">
        <div>
          <span>Gas price</span>
          <strong>{gas?.gwei != null ? `${gas.gwei < 1 ? gas.gwei.toPrecision(2) : gas.gwei.toFixed(1)} gwei` : '—'}</strong>
        </div>
        <div>
          <span>Assets</span>
          <strong>{holdings.length}</strong>
        </div>
        <div>
          <span>Token list</span>
          <strong>{bal?.tokenSource === 'fallback' ? 'static' : '1Click'}</strong>
        </div>
      </div>

      {holdings.length > 0 ? (
        <ul className="holdings">
          {holdings.map((h) => (
            <li key={`${h.owner}-${h.token ?? 'native'}`}>
              <span className="token-chip">{h.symbol}</span>
              <span className="holding-amount">{fmtAmount(h.amount)}</span>
              <span className="holding-usd">{fmtUsd(h.usd)}</span>
            </li>
          ))}
        </ul>
      ) : bal?.status !== 'OFFLINE' ? (
        <p className="empty">
          No routable assets yet. Send funds on {meta.name} to <code>{shortAddr(state.account.evmAddress)}</code>.
        </p>
      ) : null}
    </article>
  );
}
