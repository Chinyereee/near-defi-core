// providers/near-connection.js
import { formatUnits } from 'viem';
import { NEAR_CONFIG } from '../config/networks.js';

// Host only, so a URL carrying an API key never lands in logs.
const host = (u) => {
  try {
    return new URL(u).host;
  } catch {
    return String(u);
  }
};

// A JSON-RPC error (e.g. unknown account) is a real answer, not a bad node:
// it must NOT trigger failover to the next URL.
class NearRpcError extends Error {}

export class NearEcosystemClient {
  constructor({ rpcUrls = NEAR_CONFIG.rpcUrls, networkId = NEAR_CONFIG.networkId, timeoutMs = 8_000 } = {}) {
    this.rpcUrls = rpcUrls;
    this.networkId = networkId;
    this.timeoutMs = timeoutMs;
    this.preferred = 0; // sticky: start from the last node that worked
    this.warned = new Set();
  }

  async rpc(method, params) {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
    const failures = [];

    for (let k = 0; k < this.rpcUrls.length; k++) {
      const i = (this.preferred + k) % this.rpcUrls.length;
      const url = this.rpcUrls[i];
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        const text = await res.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch {
          throw new Error(`HTTP ${res.status}, non-JSON body: ${text.slice(0, 60).trim()}`);
        }
        if (json.error) {
          throw new NearRpcError(
            json.error.cause?.name || json.error.data || json.error.message || JSON.stringify(json.error)
          );
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        this.preferred = i;
        return json.result;
      } catch (err) {
        if (err instanceof NearRpcError) throw err;
        failures.push(`${host(url)}: ${err.message}`);
        if (!this.warned.has(url)) {
          this.warned.add(url);
          console.warn(`[NEAR Client] skipping ${host(url)} (${err.message})`);
        }
      }
    }
    throw new Error(`all NEAR RPC nodes failed -> ${failures.join(' | ')}`);
  }

  // Read-only contract call; returns parsed JSON.
  async view(contractId, methodName, args = {}) {
    const result = await this.rpc('query', {
      request_type: 'call_function',
      finality: 'final',
      account_id: contractId,
      method_name: methodName,
      args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
    });
    return JSON.parse(Buffer.from(result.result).toString());
  }

  // Liquid NEAR balance (yocto -> NEAR). `exists:false` for unfunded/unknown accounts.
  async getAccount(accountId) {
    try {
      const a = await this.rpc('query', { request_type: 'view_account', finality: 'final', account_id: accountId });
      return { accountId, exists: true, near: formatUnits(BigInt(a.amount), 24), storageBytes: a.storage_usage };
    } catch (err) {
      if (/does not exist|UNKNOWN_ACCOUNT/i.test(err.message)) return { accountId, exists: false, near: '0' };
      throw err;
    }
  }

  async getNetworkHeightMetrics() {
    const network = `NEAR ${this.networkId}`;
    try {
      const block = await this.rpc('block', { finality: 'final' });
      return { network, blockHeight: block.header.height, status: 'ACTIVE' };
    } catch (error) {
      console.error('[NEAR Client] fault:', error.message);
      return { network, status: 'OFFLINE', error: error.message };
    }
  }
}
