// providers/token-registry.js
// Decides WHICH tokens we read balances for on each chain, and their USD price.
// Primary source: the 1Click token list, so the dashboard tracks exactly the
// assets the router can actually move. Fallback: config/tokens.js.
import { getAddress } from 'viem';
import { EVM_CHAINS } from '../config/networks.js';
import { FALLBACK_TOKENS } from '../config/tokens.js';
import { NearIntentsClient } from './near-intents.js';

export class TokenRegistry {
  constructor({ intents = new NearIntentsClient(), chains = EVM_CHAINS } = {}) {
    this.intents = intents;
    this.chains = chains;
  }

  // Returns { [chainName]: { source, native: { symbol, priceUsd }, tokens: [...] } }
  async load() {
    let list = null;
    try {
      list = await this.intents.getTokens(); // already excludes deprecated
    } catch (err) {
      console.warn(`[TokenRegistry] 1Click token list unavailable (${err.message}); using static fallback`);
    }

    const out = {};
    for (const [name, cfg] of Object.entries(this.chains)) {
      out[name] = list ? this.#fromIntents(name, cfg, list) : this.#fromFallback(name, cfg);
    }
    return out;
  }

  #fromIntents(name, cfg, list) {
    const onChain = list.filter((t) => t.blockchain === cfg.intentsId);
    const byAddress = new Map();
    let nativePrice = null;

    for (const t of onChain) {
      if (!t.contractAddress) {
        // Entries without a contract are the chain's native asset (e.g. eth.omft.near).
        if (t.symbol?.toUpperCase() === cfg.nativeSymbol) nativePrice = t.price ?? null;
        continue;
      }
      let address;
      try {
        address = getAddress(t.contractAddress);
      } catch {
        continue; // non-EVM-shaped address; skip
      }
      if (byAddress.has(address)) continue;
      byAddress.set(address, {
        symbol: t.symbol,
        address,
        decimals: t.decimals,
        priceUsd: t.price ?? null,
        assetId: t.assetId,
      });
    }

    return {
      source: '1click',
      native: { symbol: cfg.nativeSymbol, priceUsd: nativePrice },
      tokens: [...byAddress.values()],
    };
  }

  #fromFallback(name, cfg) {
    return {
      source: 'fallback',
      native: { symbol: cfg.nativeSymbol, priceUsd: null },
      tokens: (FALLBACK_TOKENS[name] || []).map((t) => ({
        ...t,
        address: getAddress(t.address),
        priceUsd: null,
        assetId: null,
      })),
    };
  }
}
