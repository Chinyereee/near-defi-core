import type { StateResponse } from '../types';
import { shortAddr } from '../format';

export function TopBar({ state, error }: { state: StateResponse | null; error: string }) {
  const online = state && !error && state.nearNetwork.status === 'ACTIVE';
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">R</span>
        <span className="brand-name">ROUTE LAB</span>
        <span className="brand-divider">/</span>
        <span className="brand-section">NEAR Chain Abstraction</span>
      </div>
      <div className="topbar-actions">
        <span className={online ? 'net-pill' : 'net-pill net-pill-down'}>
          <span className="net-dot" aria-hidden="true" />
          {online ? `MAINNET · BLOCK ${state!.nearNetwork.blockHeight?.toLocaleString('en-US')}` : error ? 'API UNREACHABLE' : 'CONNECTING'}
        </span>
        {state && (
          <span className="account-chip" title={`${state.account.nearAccountId} controls ${state.account.evmAddress}`}>
            <span className="account-near">{state.account.nearAccountId}</span>
            <span className="account-arrow" aria-hidden="true">⇢</span>
            <span className="account-evm">{shortAddr(state.account.evmAddress)}</span>
          </span>
        )}
      </div>
    </header>
  );
}
