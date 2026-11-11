// providers/rpc-poller.js
// Multi-chain state reader.
//  - Balances: ONE Multicall3 aggregate per chain covers every token AND the
//    native balance for every watched address (getEthBalance on Multicall3),
//    instead of 1 RPC call per token per address.
//  - Transport: JSON-RPC batching + ranked fallback across public nodes.
//  - Cache: short TTL + in-flight dedupe + stale-on-error (see cache.js), so a
//    UI polling every few seconds never hammers public nodes.
import { createPublicClient, http, fallback, erc20Abi, parseAbi, formatUnits, getAddress } from 'viem';
import { EVM_CHAINS } from '../config/networks.js';
import { TokenRegistry } from './token-registry.js';
import { TtlCache } from './cache.js';

const MULTICALL3_ABI = parseAbi(['function getEthBalance(address addr) view returns (uint256)']);
const DEFAULT_MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';

const makeClient = ({ chain, rpcUrls }) =>
  createPublicClient({
    chain,
    batch: { multicall: false }, // we build multicalls explicitly
    transport: fallback(
      rpcUrls.map((u) => http(u, { timeout: 8_000, retryCount: 1, batch: true })),
      { rank: false }
    ),
  });

export class MultiChainPoller {
  /**
   * @param {object}  [opts]
   * @param {object}  [opts.chains]       chain config map (default: EVM_CHAINS)
   * @param {object}  [opts.clients]      inject viem clients (tests / custom RPC)
   * @param {object}  [opts.registry]     TokenRegistry-like { load() }
   * @param {number}  [opts.balanceTtlMs] balance cache TTL (default 12s)
   * @param {number}  [opts.gasTtlMs]     gas cache TTL (default 10s)
   */
  constructor({ chains = EVM_CHAINS, clients, registry, balanceTtlMs = 12_000, gasTtlMs = 10_000 } = {}) {
    this.chains = chains;
    this.clients =
      clients ||
      Object.fromEntries(Object.entries(chains).map(([name, cfg]) => [name, makeClient(cfg)]));
    this.registry = registry || new TokenRegistry({ chains });
    this.balanceCache = new TtlCache(balanceTtlMs);
    this.gasCache = new TtlCache(gasTtlMs);
    this.registryCache = new TtlCache(10 * 60 * 1000);
  }

  async #tokens() {
    return (await this.registryCache.get('registry', () => this.registry.load())).value;
  }

  // Cached token registry (tokens + native USD prices) for other modules.
  registrySnapshot() {
    return this.#tokens();
  }

  // ---------- gas ----------
  async fetchLiveGasMetrics() {
    const names = Object.keys(this.clients);
    const results = await Promise.allSettled(
      names.map((name) =>
        this.gasCache.get(name, async () => {
          const wei = await this.clients[name].getGasPrice();
          const gwei = Number(formatUnits(wei, 9));
          return { gasGwei: gwei.toFixed(2), gwei };
        })
      )
    );

    const out = {};
    results.forEach((r, i) => {
      const name = names[i];
      if (r.status === 'fulfilled') {
        out[name] = {
          gasGwei: r.value.value.gasGwei,
          gwei: r.value.value.gwei,
          status: r.value.stale ? 'STALE' : 'ONLINE',
          updatedAt: new Date(r.value.fetchedAt).toISOString(),
        };
      } else {
        console.error(`[EVM Poller] ${name} gas failed:`, r.reason?.shortMessage || r.reason?.message);
        out[name] = { gasGwei: null, gwei: null, status: 'OFFLINE', updatedAt: null };
      }
    });
    return out;
  }

  // ---------- balances ----------
  /**
   * @param {string[]} addresses EVM addresses to watch (e.g. Chain Signatures-derived + user's own)
   * @param {object}   [opts]
   * @param {boolean}  [opts.includeZero=false]
   * @returns {Promise<{ chains: Record<string, ChainBalances>, totalUsd: number, pricedFully: boolean }>}
   */
  async getBalances(addresses, { includeZero = false } = {}) {
    if (!addresses?.length) throw new Error('getBalances: pass at least one address');
    const watched = [...new Set(addresses.map((a) => getAddress(a)))];
    const registry = await this.#tokens();
    const names = Object.keys(this.clients);

    const settled = await Promise.allSettled(
      names.map((name) =>
        this.balanceCache.get(`${name}:${watched.join(',')}`, () =>
          this.#readChain(name, watched, registry[name])
        )
      )
    );

    const chains = {};
    let totalUsd = 0;
    let pricedFully = true;

    settled.forEach((r, i) => {
      const name = names[i];
      if (r.status === 'rejected') {
        console.error(`[EVM Poller] ${name} balances failed:`, r.reason?.shortMessage || r.reason?.message);
        chains[name] = { status: 'OFFLINE', holdings: [], totalUsd: 0, updatedAt: null, error: r.reason?.message };
        pricedFully = false;
        return;
      }
      const { value, stale, fetchedAt } = r.value;
      const holdings = includeZero ? value.holdings : value.holdings.filter((h) => h.raw !== '0');
      const chainUsd = holdings.reduce((s, h) => s + (h.usd ?? 0), 0);
      if (holdings.some((h) => h.usd === null)) pricedFully = false;
      totalUsd += chainUsd;
      chains[name] = {
        status: stale ? 'STALE' : 'ONLINE',
        tokenSource: value.tokenSource,
        failedCalls: value.failedCalls,
        holdings,
        totalUsd: chainUsd,
        updatedAt: new Date(fetchedAt).toISOString(),
      };
    });

    return { chains, totalUsd, pricedFully };
  }

  async #readChain(name, addresses, entry) {
    const client = this.clients[name];
    const multicall3 =
      this.chains[name]?.chain?.contracts?.multicall3?.address || DEFAULT_MULTICALL3;

    // Build one flat call list: per address -> [native, ...tokens]
    const plan = [];
    const contracts = [];
    for (const owner of addresses) {
      plan.push({ owner, kind: 'native', symbol: entry.native.symbol, decimals: 18, priceUsd: entry.native.priceUsd, token: null });
      contracts.push({ address: multicall3, abi: MULTICALL3_ABI, functionName: 'getEthBalance', args: [owner] });
      for (const t of entry.tokens) {
        plan.push({ owner, kind: 'erc20', symbol: t.symbol, decimals: t.decimals, priceUsd: t.priceUsd, token: t.address, assetId: t.assetId });
        contracts.push({ address: t.address, abi: erc20Abi, functionName: 'balanceOf', args: [owner] });
      }
    }

    const results = await client.multicall({
      contracts,
      allowFailure: true,
      multicallAddress: multicall3,
      batchSize: 8_192, // bytes of calldata per aggregate; keeps it to 1-2 eth_calls
    });

    // If EVERY call failed the node is the problem, not the tokens: throw so
    // the cache can serve the last good snapshot instead of a wall of zeros.
    const failedCalls = results.filter((r) => r.status === 'failure').length;
    if (failedCalls === results.length) {
      throw results[0]?.error || new Error('all multicall sub-calls failed');
    }

    const holdings = plan.map((p, i) => {
      const r = results[i];
      const raw = r.status === 'success' ? BigInt(r.result) : 0n;
      const amount = formatUnits(raw, p.decimals);
      return {
        owner: p.owner,
        kind: p.kind,
        symbol: p.symbol,
        token: p.token,
        assetId: p.assetId ?? null,
        decimals: p.decimals,
        raw: raw.toString(),
        amount,
        usd: p.priceUsd == null ? null : Number(amount) * p.priceUsd,
        ok: r.status === 'success',
      };
    });

    return { holdings, tokenSource: entry.source, failedCalls };
  }
}
