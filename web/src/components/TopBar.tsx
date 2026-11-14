import { useEffect, useRef, useState } from 'react';
import type { StateResponse } from '../types';
import { shortAddr } from '../format';
import { CopyButton } from './CopyButton';

export function TopBar({ state, error }: { state: StateResponse | null; error: string }) {
  const online = state && !error && state.nearNetwork.status === 'ACTIVE';
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const near = state?.account.near;
  const lowGas = !!near && !near.error && Number(near.near ?? 0) < 1;

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">N</span>
        <span className="brand-name">NEAR DeFi Core</span>
      </div>
      <div className="topbar-actions">                
        <span className={online ? 'net-pill' : 'net-pill net-pill-down'}>
          <span className="net-dot" aria-hidden="true" />
          {online
            ? `MAINNET \u00b7 BLOCK ${state!.nearNetwork.blockHeight?.toLocaleString('en-US')}`
            : error
              ? 'API UNREACHABLE'
              : 'CONNECTING'}
        </span>
        {state && (
          <div className="account-wrap" ref={ref}>
            <button type="button" className="account-chip" onClick={() => setOpen(!open)} aria-expanded={open}>
              {lowGas && <span className="warn-dot" title="Fund ~1 NEAR to sign" />}
              <span className="account-near">{state.account.nearAccountId}</span>
              <span className="account-arrow" aria-hidden="true">{'\u2192'}</span>
              <span className="account-evm">{shortAddr(state.account.evmAddress)}</span>
            </button>
            {open && (
              <div className="account-menu">
                <span className="account-menu-label">EVM ADDRESS</span>
                <code>{state.account.evmAddress}</code>
                <CopyButton value={state.account.evmAddress} />
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}