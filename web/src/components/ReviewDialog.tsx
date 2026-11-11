import { useEffect, useRef } from 'react';
import type { RouteQuote } from '../types';
import { CHAIN_LABEL, eta, fmtAmount, fmtUsd } from '../format';

export function ReviewDialog({
  route,
  nearAccountId,
  evmAddress,
  onClose,
}: {
  route: RouteQuote;
  nearAccountId: string;
  evmAddress: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="review-title">
        <div className="dialog-head">
          <div>
            <p className="caption caption-protocol">
              {CHAIN_LABEL[route.fromChain].toUpperCase()} → {CHAIN_LABEL[route.toChain].toUpperCase()}
            </p>
            <h2 id="review-title">Review route</h2>
          </div>
          <button ref={closeRef} className="dialog-close" type="button" aria-label="Close review" onClick={onClose}>
            ×
          </button>
        </div>
        <dl className="review">
          <div><dt>Signer</dt><dd>{nearAccountId} <span>via v1.signer MPC</span></dd></div>
          <div><dt>From / to address</dt><dd className="mono-break">{evmAddress}</dd></div>
          <div><dt>Send</dt><dd>{fmtAmount(route.amountIn, 6)} {route.fromSymbol} on {CHAIN_LABEL[route.fromChain]}</dd></div>
          <div><dt>Receive</dt><dd>{fmtAmount(route.amountOut, 6)} {route.toSymbol} on {CHAIN_LABEL[route.toChain]} <span>min {fmtAmount(route.minAmountOut, 4)} after 1% slippage</span></dd></div>
          <div><dt>Costs</dt><dd>{fmtUsd(route.routeFeeUsd)} route fee · {fmtUsd(route.depositGasUsd)} gas</dd></div>
          <div><dt>Net value</dt><dd>{fmtUsd(route.netUsd)} <span>ETA {eta(route.timeEstimateSec)} after deposit confirms</span></dd></div>
        </dl>
        <p className="dialog-note">
          This is a dry quote: no deposit address was issued and nothing is signed. Execution turns on once the NEAR account is funded and the
          Chain Signatures signing step ships.
        </p>
        <div className="dialog-actions">
          <button className="btn-ghost" type="button" onClick={onClose}>Back to routes</button>
          <button className="btn-primary" type="button" disabled title="Available after signing is wired">
            Sign with {nearAccountId}
          </button>
        </div>
      </section>
    </div>
  );
}
