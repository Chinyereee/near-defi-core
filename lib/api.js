// lib/api.js
// Framework-agnostic API core. Used by:
//   server.js            local dev / any long-running Node host
//   api/state.js         Vercel serverless function
//   api/routes.js        Vercel serverless function
// Module-level caches persist for the life of a warm instance; on Vercel the
// CDN cache (s-maxage, see api/*) is the shared layer across all visitors.
import 'dotenv/config';
import { formatUnits } from 'viem';
import { EVM_CHAINS, NEAR_CONFIG } from '../config/networks.js';
import { MultiChainPoller } from '../providers/rpc-poller.js';
import { NearEcosystemClient } from '../providers/near-connection.js';
import { NearIntentsClient } from '../providers/near-intents.js';
import { deriveEvmAccount, DEFAULT_EVM_PATH } from '../providers/chain-signatures.js';
import { TtlCache } from '../providers/cache.js';

const ROUTE_SYMBOLS = ['USDC', 'USDT'];
const ERC20_TRANSFER_GAS = 65_000; // typical ERC-20 transfer into the 1Click deposit address
const MAX_AMOUNT = 1_000_000;

const nearAccountId = process.env.NEAR_ACCOUNT_ID;
const path = process.env.CHAIN_SIG_PATH || DEFAULT_EVM_PATH;
// Throwing (not exiting) keeps a misconfigured serverless function answering
// with a readable 500 instead of crashing.
const account = nearAccountId
  ? deriveEvmAccount({ predecessor: nearAccountId, path, mpcContract: NEAR_CONFIG.mpcContract })
  : null;
const requireAccount = () => {
  if (!account) throw httpError(500, 'NEAR_ACCOUNT_ID is not set (add it to .env locally, or to the Vercel project env vars)');
  return account;
};

const poller = new MultiChainPoller();
const near = new NearEcosystemClient();
const intents = new NearIntentsClient();
const nearCache = new TtlCache(15_000);
const routeCache = new TtlCache(15_000);

// ---------- handlers ----------
export async function getState() {
  requireAccount();
  const [gas, balances, nearAcct, nearNet] = await Promise.all([
    poller.fetchLiveGasMetrics(),
    poller.getBalances([account.address]),
    nearCache.get('acct', () => near.getAccount(nearAccountId)).then((r) => r.value).catch((e) => ({ error: e.message })),
    nearCache.get('net', () => near.getNetworkHeightMetrics()).then((r) => r.value),
  ]);
  return {
    account: {
      nearAccountId,
      path,
      evmAddress: account.address,
      mpcContract: NEAR_CONFIG.mpcContract,
      near: nearAcct,
    },
    chains: Object.fromEntries(
      Object.entries(EVM_CHAINS).map(([k, c]) => [k, { name: c.chain.name, chainId: c.chain.id, nativeSymbol: c.nativeSymbol }])
    ),
    gas,
    balances,
    nearNetwork: nearNet,
    serverTime: new Date().toISOString(),
  };
}

const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

export async function getRoutes({ from, symbol, amount }) {
  requireAccount();
  if (!EVM_CHAINS[from]) throw httpError(400, `unknown origin chain "${from}"`);
  if (!ROUTE_SYMBOLS.includes(symbol)) throw httpError(400, `symbol must be one of ${ROUTE_SYMBOLS.join(', ')}`);
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0 || amt > MAX_AMOUNT) throw httpError(400, 'amount must be > 0 and <= 1,000,000');

  const key = `${from}:${symbol}:${amount}`;
  const { value, fetchedAt, stale } = await routeCache.get(key, async () => {
    const tokens = await intents.getTokens();
    const fromAsset = intents.findAsset(tokens, symbol, EVM_CHAINS[from].intentsId);
    if (!fromAsset) throw httpError(404, `${symbol} on ${from} is not routable via 1Click`);

    const targets = [];
    for (const [to, cfg] of Object.entries(EVM_CHAINS)) {
      if (to === from) continue;
      for (const outSym of ROUTE_SYMBOLS) {
        const asset = intents.findAsset(tokens, outSym, cfg.intentsId);
        if (asset) targets.push({ to, outSym, asset });
      }
    }

    // Origin-chain deposit gas, priced in USD: the cost the flash-loan Route Lab
    // could not compute. gas price (gwei) * gas units * native USD price.
    const [gas, registry] = await Promise.all([poller.fetchLiveGasMetrics(), poller.registrySnapshot()]);
    const gwei = num(gas[from]?.gwei);
    const nativeUsd = registry[from]?.native?.priceUsd ?? null;
    const depositGasUsd = gwei != null && nativeUsd != null ? gwei * 1e-9 * ERC20_TRANSFER_GAS * nativeUsd : null;

    const settled = await Promise.allSettled(
      targets.map((t) =>
        intents.dryQuote({
          from: fromAsset,
          to: t.asset,
          amountHuman: String(amount),
          refundTo: account.address,
          recipient: account.address,
        })
      )
    );

    const routes = settled.map((r, i) => {
      const t = targets[i];
      const base = {
        id: `${from}-${symbol}->${t.to}-${t.outSym}`,
        fromChain: from,
        fromSymbol: symbol,
        toChain: t.to,
        toSymbol: t.outSym,
        originAssetId: fromAsset.assetId,
        destinationAssetId: t.asset.assetId,
      };
      if (r.status === 'rejected') return { ...base, status: 'error', error: shortError(r.reason) };
      const q = r.value.quote || {};
      const inUsd = num(q.amountInUsd);
      const outUsd = num(q.amountOutUsd);
      const feeUsd = inUsd != null && outUsd != null ? inUsd - outUsd : null;
      const netUsd = outUsd != null ? outUsd - (depositGasUsd ?? 0) : null;
      return {
        ...base,
        status: 'ok',
        amountIn: q.amountInFormatted ?? null,
        amountInUsd: inUsd,
        amountOut: q.amountOutFormatted ?? (q.amountOut ? formatUnits(BigInt(q.amountOut), t.asset.decimals) : null),
        amountOutUsd: outUsd,
        minAmountOut: q.minAmountOut ? formatUnits(BigInt(q.minAmountOut), t.asset.decimals) : null,
        timeEstimateSec: num(q.timeEstimate),
        routeFeeUsd: feeUsd,
        depositGasUsd,
        netUsd,
      };
    });

    const ok = routes.filter((r) => r.status === 'ok' && r.netUsd != null).sort((a, b) => b.netUsd - a.netUsd);
    if (ok[0]) ok[0].best = true;
    const ranked = [...ok, ...routes.filter((r) => !ok.includes(r))];

    return {
      request: { from, symbol, amount: String(amount) },
      gas: { chain: from, gwei, nativeSymbol: EVM_CHAINS[from].nativeSymbol, nativeUsd, units: ERC20_TRANSFER_GAS },
      routes: ranked,
    };
  });
  return { ...value, quotedAt: new Date(fetchedAt).toISOString(), stale };
}

// ---------- plumbing ----------
export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function shortError(err) {
  const m = String(err?.message || err);
  const json = m.match(/\{.*\}$/);
  if (json) {
    try {
      const p = JSON.parse(json[0]);
      return p.message || p.error || m;
    } catch {
      /* fall through */
    }
  }
  return m.length > 160 ? `${m.slice(0, 157)}…` : m;
}

/** Parse /api/routes query params with the same defaults everywhere. */
export const routeParams = (q) => ({
  from: q.from || 'base',
  symbol: String(q.symbol || 'USDC').toUpperCase(),
  amount: q.amount || '10',
});

export const accountSummary = () => (account ? `${nearAccountId} → ${account.address} (path "${path}")` : 'NEAR_ACCOUNT_ID not set');
