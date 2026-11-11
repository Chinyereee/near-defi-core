import type { StateResponse } from '../types';
import { fmtAmount } from '../format';
import { CopyButton } from './CopyButton';

/** Route Lab's "borrow board", repurposed as the signer identity panel. */
export function AccountBoard({ state }: { state: StateResponse }) {
  const { account } = state;
  const near = account.near;
  const nearText = !near
    ? '—'
    : near.error
      ? 'Lookup failed'
      : near.exists === false
        ? 'Not on-chain yet'
        : `${fmtAmount(near.near, 4)} NEAR`;
  const unfunded = near && !near.error && Number(near.near ?? 0) === 0;

  return (
    <section className="panel board" aria-label="Signer identity">
      <div className="board-heading">
        <div>
          <p className="caption caption-protocol">SIGNER · CHAIN SIGNATURES</p>
          <h2>One NEAR account controls this address on every EVM chain</h2>
          <p className="muted">
            Derived from <code>{account.nearAccountId}</code> + path <code>{account.path}</code> + the MPC root key, and
            verified against <code>{account.mpcContract}</code>.
          </p>
        </div>
      </div>
      <div className="board-grid">
        <div className="board-item">
          <span>NEAR account</span>
          <strong>{account.nearAccountId}</strong>
        </div>
        <div className="board-item board-item-wide">
          <span>Derived EVM address</span>
          <strong className="mono-break">{account.evmAddress}</strong>
          <CopyButton value={account.evmAddress} />
        </div>
        <div className="board-item">
          <span>MPC signer</span>
          <strong>{account.mpcContract}</strong>
        </div>
        <div className={unfunded ? 'board-item board-item-warn' : 'board-item'}>
          <span>NEAR balance</span>
          <strong>{nearText}</strong>
          {unfunded && <em>Fund ~1 NEAR to sign</em>}
        </div>
      </div>
    </section>
  );
}
