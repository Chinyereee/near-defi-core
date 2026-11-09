import { MultiChainPoller } from './providers/rpc-poller.js';

async function main() {
  console.log("? [x402 Agent] Starting Unstoppable DeFi Protocol Multi-Chain Aggregator...");
  const poller = new MultiChainPoller();

  try {
    console.log("?? Testing real-time synchronous JSON-RPC provider nodes...");
    const systemState = await poller.fetchLiveGasMetrics();
    
    console.log("\n?? CURRENT CROSS-CHAIN LIVELINESS SYSTEM METRICS MATRIX:");
    console.table(systemState);
  } catch (error) {
    console.error("? System execution failed during core pipeline initialization:", error.message);
  }
}

main();
