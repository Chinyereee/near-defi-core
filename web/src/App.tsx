import { useCallback, useMemo, useState } from 'react';
import { fetchRoutes, fetchState, useNow, usePolling } from './api';
import type { ChainKey, RouteQuote } from './types';
import { CHAIN_ORDER, fmtUsd } from './format';
import { TopBar } from './components/TopBar';
import { ChainCard } from './components/ChainCard';
import { RoutePanel } from './components/RoutePanel';
import { ReviewDialog } from './components/ReviewDialog';

// Start from the chain that holds the most of the selected token. Base if all are empty.
function pickOrigin(s: any, symbol: string): ChainKey {
  const fallback: ChainKey = symbol === 'USDT' ? 'polygon' : 'base';
  if (!s) return fallback;
  let best: ChainKey = fallback;
  let bestUsd = 0;
  for (const c of CHAIN_ORDER) {
    const h = s.balances?.chains?.[c]?.holdings?.find((x: any) => x.symbol === symbol);
    const usd = Number(h?.usd ?? 0);
    if (usd > bestUsd) {
      best = c;
      bestUsd = usd;
    }
  }
  return best;
}

export default function App() {
  const now = useNow(5000);
  const [amount, setAmount] = useState('10');
  const [symbol, setSymbol] = useState('USDC');
  const [review, setReview] = useState<RouteQuote | null>(null);

  const state = usePolling(fetchState, { intervalMs: 15_000 });
  const s = state.data;
  const from = useMemo(() => pickOrigin(s, symbol), [s, symbol]);

  const amountValid = /^\d*\.?\d+$/.test(amount) && Number(amount) > 0;
  const loadRoutes = useCallback(
    (signal: AbortSignal) => fetchRoutes({ from, symbol, amount }, signal),
    [from, symbol, amount]
  );
  const routes = usePolling(loadRoutes, {
    key: `${from}:${symbol}:${amount}`,
    intervalMs: 30_000,
    debounceMs: 450,
    enabled: amountValid && Boolean(state.data),
  });

  const total = s?.balances.totalUsd ?? null;

  return (
    <main className="shell">
      <TopBar state={s} error={state.error} />

      <div className="content">
        <section className="heading">
          <div>
            <p className="caption caption-runtime">CHAIN-ABSTRACTED ACCOUNT</p>
            <h1>One NEAR account. Every EVM chain.</h1>
            <p className="muted">Live balances and solver-quoted routes. No network switching.</p>
          </div>
          <div className="total">
            <span>Unified balance</span>
            <strong>{total == null ? '\u2014' : fmtUsd(total)}</strong>
            {s && !s.balances.pricedFully && <em>partial: a chain is offline or an asset is unpriced</em>}
          </div>
        </section>

        {!s && (
          <div className={state.error ? 'notice notice-error' : 'notice'} role={state.error ? 'alert' : 'status'}>
            <span className="notice-mark" aria-hidden="true">!</span>
            <span>
              {state.error
                ? `Can't reach the API: ${state.error}. Is "npm run dev" running?`
                : 'Reading chains\u2026'}
            </span>
          </div>
        )}

        {s && (
          <>
            <section className="chain-grid" aria-label="Balances by chain">
              {CHAIN_ORDER.map((c, i) => (
                <ChainCard key={c} chain={c} index={i} state={s} now={now} onRetry={state.refresh} />
              ))}
            </section>

            <RoutePanel
              amount={amount}
              setAmount={setAmount}
              symbol={symbol}
              setSymbol={setSymbol}
              from={from}
              routes={routes.data}
              loading={routes.loading}
              error={routes.error}
              now={now}
              evmAddress={s.account.evmAddress}
              onRetry={routes.refresh}
              onReview={setReview}
            />

            <p className="footnote">Quotes are dry runs. Nothing moves.</p>
          </>
        )}
      </div>

      {review && s && (
        <ReviewDialog
          route={review}
          nearAccountId={s.account.nearAccountId}
          evmAddress={s.account.evmAddress}
          onClose={() => setReview(null)}
        />
      )}
    </main>
  );
}
