// scripts/verify-derivation.js
// Proves the offline derivation matches what the live MPC contract will sign with.
// Usage: npm run verify:derivation [-- <nearAccountId> <path>]
import 'dotenv/config';
import { NEAR_CONFIG } from '../config/networks.js';
import { NearEcosystemClient } from '../providers/near-connection.js';
import {
  deriveEvmAccount,
  najToUncompressedHex,
  evmAddressFromPublicKey,
  MPC_ROOT_KEYS,
  DEFAULT_EVM_PATH,
} from '../providers/chain-signatures.js';

const predecessor = process.argv[2] || process.env.NEAR_ACCOUNT_ID;
const path = process.argv[3] || process.env.CHAIN_SIG_PATH || DEFAULT_EVM_PATH;
if (!predecessor) {
  console.error('Set NEAR_ACCOUNT_ID in .env or pass it as an argument.');
  process.exit(1);
}

const near = new NearEcosystemClient();
const contract = NEAR_CONFIG.mpcContract;

const local = deriveEvmAccount({ predecessor, path, mpcContract: contract });
console.log(`Offline  ${local.address}  (${predecessor}, path "${path}")`);

const liveRoot = await near.view(contract, 'public_key');
const rootOk = liveRoot === MPC_ROOT_KEYS[contract];
console.log(`Root key ${rootOk ? 'matches' : 'DIFFERS from'} the hardcoded constant`);

// Newer contract versions take domain_id (0 = secp256k1); fall back if rejected.
let derived;
try {
  derived = await near.view(contract, 'derived_public_key', { path, predecessor, domain_id: 0 });
} catch {
  derived = await near.view(contract, 'derived_public_key', { path, predecessor });
}
const liveAddress = evmAddressFromPublicKey(najToUncompressedHex(derived));
console.log(`Contract ${liveAddress}`);

if (liveAddress === local.address && rootOk) {
  console.log('\n✅ Derivation verified against', contract);
} else {
  console.error('\n❌ Mismatch: do NOT send funds to the offline address until this is resolved.');
  process.exit(1);
}
