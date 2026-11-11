// providers/near-intents.js
// Thin client for the NEAR Intents 1Click API (mainnet only; no testnet exists).
import 'dotenv/config';
import { parseUnits } from 'viem';
import { ONE_CLICK_BASE_URL } from '../config/networks.js';
import { TtlCache } from './cache.js';

const TOKEN_LIST_TTL_MS = 10 * 60 * 1000;

// 1Click marks retired assets by suffixing the symbol, e.g. "USDC(DEPRECATED)".
// Retired entries can share a contractAddress with the live one, so filter them
// out anywhere we index by address (exact-symbol lookups already skip them).
export const isDeprecated = (t) => /DEPRECATED/i.test(t.symbol || '');

// Human amount -> base units without float drift (5.1 * 1e18 is not exact).
const toBaseUnits = (amountHuman, decimals) => {
  let s = typeof amountHuman === 'string' ? amountHuman.trim() : String(amountHuman);
  if (/e/i.test(s)) s = Number(amountHuman).toFixed(decimals);
  return parseUnits(s, decimals).toString();
};

export class NearIntentsClient {
  constructor({ jwt = process.env.NEAR_INTENTS_JWT, baseUrl = ONE_CLICK_BASE_URL } = {}) {
    this.jwt = jwt;
    this.baseUrl = baseUrl;
    this.tokenCache = new TtlCache(TOKEN_LIST_TTL_MS);
  }

  headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.jwt) h.Authorization = `Bearer ${this.jwt}`;
    return h;
  }

  // Full token list (cached 10 min). Includes USD `price` per asset.
  async getTokens({ includeDeprecated = false } = {}) {
    const { value } = await this.tokenCache.get('tokens', async () => {
      const res = await fetch(`${this.baseUrl}/v0/tokens`);
      if (!res.ok) throw new Error(`1Click /v0/tokens ${res.status}`);
      return res.json();
    });
    return includeDeprecated ? value : value.filter((t) => !isDeprecated(t));
  }

  // Exact symbol match on one chain; never returns a deprecated asset.
  // Prefers nep141 (current bridged form) when duplicates exist.
  findAsset(tokens, symbol, blockchain) {
    const matches = tokens.filter(
      (t) =>
        t.blockchain === blockchain &&
        !isDeprecated(t) &&
        t.symbol?.toUpperCase() === symbol.toUpperCase()
    );
    return matches.find((t) => t.assetId?.startsWith('nep141:')) || matches[0];
  }

  // dry: true = preview only. No deposit address is issued and no funds move.
  async dryQuote({ from, to, amountHuman, refundTo, recipient, slippageBps = 100 }) {
    const body = {
      dry: true,
      swapType: 'EXACT_INPUT',
      slippageTolerance: slippageBps,
      originAsset: from.assetId,
      depositType: 'ORIGIN_CHAIN',
      destinationAsset: to.assetId,
      amount: toBaseUnits(amountHuman, from.decimals),
      refundTo,
      refundType: 'ORIGIN_CHAIN',
      recipient,
      recipientType: 'DESTINATION_CHAIN',
      deadline: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };

    const res = await fetch(`${this.baseUrl}/v0/quote`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`1Click /v0/quote ${res.status}: ${JSON.stringify(json)}`);
    return json;
  }
}
