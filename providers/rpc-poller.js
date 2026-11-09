import { createPublicClient, http } from 'viem';
import { mainnet, polygon, base } from 'viem/chains';
import { evmConfig } from '../config/networks.js';

export class MultiChainPoller {
  constructor() {
    this.clients = {
      ethereum: createPublicClient({ chain: mainnet, transport: http(evmConfig.ethereum.rpcUrl) }),
      polygon: createPublicClient({ chain: polygon, transport: http(evmConfig.polygon.rpcUrl) }),
      base: createPublicClient({ chain: base, transport: http(evmConfig.base.rpcUrl) })
    };
  }

  async fetchLiveGasMetrics() {
    try {
      const promises = Object.entries(this.clients).map(async ([chainName, client]) => {
        const gasPriceInWei = await client.getGasPrice();
        const gasPriceInGwei = (Number(gasPriceInWei) / 1e9).toFixed(2);
        return { chain: chainName, gasGwei: gasPriceInGwei, status: "ONLINE" };
      });

      const metricsArray = await Promise.all(promises);
      
      return metricsArray.reduce((acc, current) => {
        acc[current.chain] = { gasGwei: current.gasGwei, status: current.status, updatedAt: new Date().toLocaleTimeString() };
        return acc;
      }, {});
    } catch (error) {
      console.error("? Multi-chain JSON-RPC network node timeout:", error.message);
      throw error;
    }
  }
}
