import { useEffect, useMemo, useState } from 'react';
import type { ChainKey, RouteQuote, RoutesResponse } from '../types';
import { CHAIN_LABEL, CHAIN_MARK, CHAIN_ORDER, eta, fmtAmount, fmtUsd, shortAddr } from '../format';
import { Freshness, type FreshState } from './Freshness';

type Props = {
  amount: string;
  setAmount: (v: string) => void;
  symbol: string;
  setSymbol: (v: string) => void;
  from: ChainKey;
  setFrom: (v: ChainKey) => void;
  routes: RoutesResponse | null;
  loading: boolean;
  error: string;
  now: number;
  evmAddress: string;
  onRetry: () => void;
  onReview: (r: RouteQuote) => void;
};

const SYMBOLS = ['USDC', 'USDT'];

export function RoutePanel(p: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const list = p.routes?.routes ?? [];
  const live = list.filter((r) => r.status === 'ok');

  // Keep the user's pick across refreshes; otherwise follow the best route.
  useEffect(() => {
    if (!list.length) return;
    if (!selectedId || !list.some((r) => r.id === selectedId)) setSelectedId((list.find((r) => r.best) ?? list[0]).id);
  }, [list, selectedId]);

  const selected = useMemo(() => list.find((r) => r.id === selectedId) ?? null, [list, selectedId]);
  const amountValid = /^\d*\.?\d+$/.test(p.amount) && Number(p.amount) > 0;

  const fresh: FreshState = !amountValid
    ? 'idle'
    : p.error && !p.routes
      ? 'error'
      : p.loading && !p.routes
        ? 'loading'
        : p.routes?.stale
          ? 'stale'
          : p.routes
            ? 'live'
            : 'loading';

  const badge = (r: RouteQuote) =>
    r.status === 'error' ? 'UNAVAILABLE' : live.length < 2 ? 'ONLY LIVE' : r.best ? 'BEST NET' : 'LIVE';

  return (
    <section className="panel routes" aria-label="Cross-chain routes">
      <div className="routes-heading">
        <div>
          <p className="caption caption-runtime">ROUTER · NEAR INTENTS 1CLICK</p>
          <h2>Where should this {p.symbol} go?</h2>
          <p className="muted">
            Solver quotes for every destination, ranked by what actually lands after route fees and origin-chain gas.
          </p>
        </div>
        <Freshness
          state={fresh}
          updatedAt={p.routes?.quotedAt}
          now={p.now}
          label={fresh === 'idle' ? 'ENTER AN AMOUNT' : fresh === 'error' ? `QUOTES FAILED · ${p.error}` : undefined}
          onRetry={p.onRetry}
        />
      </div>

      <div className="route-controls">
        <label className="amount-field">
          <span>Amount</span>
          <span className="amount-input">
            <input
              inputMode="decimal"
              value={p.amount}
              onChange={(e) => p.setAmount(e.target.value.replace(/[^\d.]/g, ''))}
              aria-label="Amount to route"
              aria-invalid={!amountValid}
            />
            <span>{p.symbol}</span>
          </span>
        </label>
        <div className="seg" role="group" aria-label="Asset">
          {SYMBOLS.map((s) => (
            <button key={s} type="button" className={s === p.symbol ? 'seg-btn seg-on' : 'seg-btn'} aria-pressed={s === p.symbol} onClick={() => p.setSymbol(s)}>
              {s}
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Origin chain">
          <span className="seg-label">from</span>
          {CHAIN_ORDER.map((c) => (
            <button key={c} type="button" className={c === p.from ? 'seg-btn seg-on' : 'seg-btn'} aria-pressed={c === p.from} onClick={() => p.setFrom(c)}>
              {CHAIN_LABEL[c]}
            </button>
          ))}
        </div>
      </div>

      <div className="routes-body">
        <div className="route-options" role="listbox" aria-label="Route options">
          {list.length === 0 && (
            <p className="empty">{fresh === 'loading' ? 'Asking solvers for quotes…' : fresh === 'idle' ? 'Enter an amount above zero.' : 'No routes yet.'}</p>
          )}
          {list.map((r) => (
            <button
              key={r.id}
              type="button"
              role="option"
              aria-selected={r.id === selectedId}
              className={['route-option', r.id === selectedId && 'route-option-on', r.status === 'error' && 'route-option-error'].filter(Boolean).join(' ')}
              onClick={() => setSelectedId(r.id)}
            >
              <span className="option-mark">{CHAIN_MARK[r.toChain]}</span>
              <span className="option-copy">
                <span className="option-title">
                  {CHAIN_LABEL[r.toChain]} · {r.toSymbol}
                  <span className={r.best ? 'badge badge-best' : r.status === 'error' ? 'badge badge-err' : 'badge'}>{badge(r)}</span>
                </span>
                <span className="option-sub">{r.status === 'error' ? r.error : `${eta(r.timeEstimateSec)} · fee ${fmtUsd(r.routeFeeUsd)}`}</span>
              </span>
              <span className="option-quote">
                {r.status === 'ok' ? fmtAmount(r.amountOut, 4) : '—'}
                <span>{r.toSymbol} out</span>
              </span>
            </button>
          ))}
        </div>

        <div className="route-detail" aria-live="polite">
          {selected && selected.status === 'ok' ? (
            <>
              <div className="result-label">You receive on {CHAIN_LABEL[selected.toChain]}</div>
              <div className="result-amount">
                {fmtAmount(selected.amountOut, 6)} <span>{selected.toSymbol}</span>
              </div>
              <div className="metrics">
                <div>
                  <span>Net value</span>
                  <strong className="pos">{fmtUsd(selected.netUsd)}</strong>
                </div>
                <div>
                  <span>Min. after slippage</span>
                  <strong>{fmtAmount(selected.minAmountOut, 4)}</strong>
                </div>
                <div>
                  <span>Solver ETA</span>
                  <strong>{eta(selected.timeEstimateSec)}</strong>
                </div>
              </div>

              <div className="breakdown" aria-label="Net value breakdown">
                <div>
                  <span>Amount in</span>
                  <strong>
                    {fmtAmount(selected.amountIn, 6)} {selected.fromSymbol} · {fmtUsd(selected.amountInUsd)}
                  </strong>
                </div>
                <div>
                  <span>Route fee (solver spread)</span>
                  <strong className="neg">−{fmtUsd(selected.routeFeeUsd)}</strong>
                </div>
                <div>
                  <span>
                    Deposit gas on {CHAIN_LABEL[selected.fromChain]}
                    {p.routes?.gas.gwei != null && ` · ${p.routes.gas.units.toLocaleString('en-US')} gas`}
                  </span>
                  <strong className="neg">{selected.depositGasUsd == null ? 'Not priced' : `−${fmtUsd(selected.depositGasUsd)}`}</strong>
                </div>
                <div className="breakdown-total">
                  <span>Net value received</span>
                  <strong>{fmtUsd(selected.netUsd)}</strong>
                </div>
              </div>

              <button
                className="details-toggle"
                type="button"
                aria-expanded={detailsOpen}
                aria-controls="route-hops"
                onClick={() => setDetailsOpen((o) => !o)}
              >
                <span>Route details</span>
                <span>3 hops · deposit → solver → withdraw</span>
                <span aria-hidden="true">{detailsOpen ? '−' : '+'}</span>
              </button>
              {detailsOpen && (
                <ol className="hops" id="route-hops">
                  <li>
                    <div className="hop-head">
                      <span>HOP 01</span>
                      <strong>Deposit on {CHAIN_LABEL[selected.fromChain]}</strong>
                      <span>chain-sig tx</span>
                    </div>
                    <p>
                      {shortAddr(p.evmAddress)} sends {fmtAmount(selected.amountIn, 6)} {selected.fromSymbol} to a 1Click deposit address. Signed by
                      the MPC network on behalf of the NEAR account; needs {CHAIN_LABEL[selected.fromChain]} gas.
                    </p>
                  </li>
                  <li>
                    <div className="hop-head">
                      <span>HOP 02</span>
                      <strong>Solver fill on NEAR Intents</strong>
                      <span>intents.near</span>
                    </div>
                    <p>Competing solvers settle the swap against the quote; if no fill before the deadline, funds refund to the origin address.</p>
                  </li>
                  <li>
                    <div className="hop-head">
                      <span>HOP 03</span>
                      <strong>Withdraw to {CHAIN_LABEL[selected.toChain]}</strong>
                      <span>{selected.toSymbol}</span>
                    </div>
                    <p>
                      ≥ {fmtAmount(selected.minAmountOut, 4)} {selected.toSymbol} arrives at the same address {shortAddr(p.evmAddress)} on{' '}
                      {CHAIN_LABEL[selected.toChain]}.
                    </p>
                  </li>
                </ol>
              )}

              <button className="cta" type="button" onClick={() => p.onReview(selected)}>
                <span>Review route</span>
                <strong>
                  {fmtAmount(selected.amountOut, 4)} {selected.toSymbol} <span aria-hidden="true">↗</span>
                </strong>
              </button>
            </>
          ) : selected?.status === 'error' ? (
            <div className="detail-empty">
              <p className="caption">ROUTE UNAVAILABLE</p>
              <p>{selected.error}</p>
              <p className="muted small">The solver network declined this pair at this size. Pick another destination or change the amount.</p>
            </div>
          ) : (
            <div className="detail-empty">
              <p className="muted">Pick a route to see the full breakdown.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
