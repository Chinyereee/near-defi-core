// index.js
// Usage:  npm start                      -> derived address of NEAR_ACCOUNT_ID
//         npm start -- 0xExtra 0xMore    -> plus any extra EVM addresses
// .env:   NEAR_ACCOUNT_ID=chinchinnn.near
//         CHAIN_SIG_PATH=ethereum-1        (optional)
//         WATCH_ADDRESSES=0xabc,0xdef      (optional)
import 'dotenv/config';
import { MultiChainPoller } from './providers/rpc-poller.js';
import { NearEcosystemClient } from './providers/near-connection.js';
import { deriveEvmAccount, DEFAULT_EVM_PATH } from './providers/chain-signatures.js';
import { NEAR_CONFIG } from './config/networks.js';

const nearAccountId = process.env.NEAR_ACCOUNT_ID;
const path = process.env.CHAIN_SIG_PATH || DEFAULT_EVM_PATH;

const extra = [
  ...process.argv.slice(2),
  ...(process.env.WATCH_ADDRESSES || '').split(',').map((s) => s.trim()).filter(Boolean),
];

const usd = (n) => (n == null ? '—' : `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

async function main() {
  console.log('⚡ [near-defi-core] Unified multi-chain state\n');

  const watch = [];
  const labels = {};
  if (nearAccountId) {
    const acct = deriveEvmAccount({ predecessor: nearAccountId, path, mpcContract: NEAR_CONFIG.mpcContract });
    watch.push(acct.address);
    labels[acct.address] = `${nearAccountId} (chain-sig)`;
    console.log(`🔑 ${nearAccountId} → EVM ${acct.address}  [path "${path}", same on Ethereum/Polygon/Base]`);
  }
  for (const a of extra) {
    if (!watch.some((w) => w.toLowerCase() === a.toLowerCase())) watch.push(a);
  }
  if (!watch.length) {
    console.error('Nothing to watch: set NEAR_ACCOUNT_ID in .env or pass an EVM address.');
    process.exit(1);
  }

  const evm = new MultiChainPoller();
  const near = new NearEcosystemClient();

  const [gas, balances, nearState, nearAcct] = await Promise.all([
    evm.fetchLiveGasMetrics(),
    evm.getBalances(watch),
    near.getNetworkHeightMetrics(),
    nearAccountId ? near.getAccount(nearAccountId).catch((e) => ({ error: e.message })) : null,
  ]);

  console.log('\n⛽ Gas');
  console.table(gas);

  console.log('\n💼 EVM balances');
  const rows = [];
  for (const [chain, c] of Object.entries(balances.chains)) {
    if (!c.holdings.length) {
      rows.push({ chain, owner: '', asset: c.status === 'OFFLINE' ? '(offline)' : '(empty)', amount: '', usd: '', status: c.status });
    }
    for (const h of c.holdings) {
      rows.push({
        chain,
        owner: labels[h.owner] || short(h.owner),
        asset: h.symbol,
        amount: Number(h.amount).toLocaleString('en-US', { maximumFractionDigits: 6 }),
        usd: usd(h.usd),
        status: c.status,
      });
    }
  }
  console.table(rows);
  console.log(
    `EVM total: ${usd(balances.totalUsd)}${balances.pricedFully ? '' : '  (partial: some assets unpriced or a chain offline)'}`
  );

  console.log('\n🛰️ NEAR');
  if (nearAcct) {
    console.log(
      nearAcct.error
        ? `  ${nearAccountId}: lookup failed (${nearAcct.error})`
        : nearAcct.exists
          ? `  ${nearAccountId}: ${Number(nearAcct.near).toFixed(4)} NEAR`
          : `  ${nearAccountId}: not found on ${NEAR_CONFIG.networkId}`
    );
  }
  console.log(' ', nearState);
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
