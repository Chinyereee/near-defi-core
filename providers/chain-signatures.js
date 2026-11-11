// providers/chain-signatures.js
// NEAR Chain Signatures: deterministic EVM address for a NEAR account.
//
// The MPC network holds one root secp256k1 key. For any (predecessor, path),
// the contract signs with the child key
//     child = root + epsilon * G
//     epsilon = sha3_256("near-mpc-recovery v0.1.0 epsilon derivation:<predecessor>,<path>")
// so the child PUBLIC key, and the EVM address keccak256(pubkey)[12:], can be
// computed offline. Same path => same address on Ethereum, Polygon and Base.
//
// This mirrors chainsig.js (the library the NEAR docs recommend) exactly; it is
// reimplemented here because chainsig.js pulls ~210 MB of non-EVM SDKs.
// Equivalence is covered by tests, and `npm run verify:derivation` checks the
// result against the live contract's own `derived_public_key` view.
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha3_256 } from '@noble/hashes/sha3.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { base58 } from '@scure/base';
import { keccak256, getAddress } from 'viem';

// Root MPC public keys (same constants chainsig.js ships). If the MPC network
// ever rotates its root key, verify:derivation will flag the mismatch.
export const MPC_ROOT_KEYS = {
  'v1.signer':
    'secp256k1:3tFRbMqmoa6AAALMrEFAYCEoHcqKxeW38YptwowBVBtXK1vo36HDbUWuR6EZmoK4JcH6HDkNMGGqP1ouV7VZUWya',
  'v1.signer-prod.testnet':
    'secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3',
};

export const DEFAULT_EVM_PATH = 'ethereum-1';

// "secp256k1:<base58 of 64-byte X||Y>" -> "04<128 hex>"
export const najToUncompressedHex = (najKey) => {
  const [curve, b58] = najKey.split(':');
  if (curve !== 'secp256k1') throw new Error(`expected secp256k1 key, got ${curve}`);
  const raw = base58.decode(b58);
  if (raw.length !== 64) throw new Error(`bad key length ${raw.length}`);
  return `04${bytesToHex(raw)}`;
};

export const deriveEpsilon = (predecessor, path) => {
  const digest = sha3_256(utf8ToBytes(`near-mpc-recovery v0.1.0 epsilon derivation:${predecessor},${path}`));
  const e = BigInt(`0x${bytesToHex(digest)}`) % secp256k1.Point.CURVE().n;
  if (e === 0n) throw new Error('degenerate epsilon');
  return e;
};

/** @returns {`04${string}`} uncompressed SEC1 child public key, hex */
export const deriveChildPublicKey = (rootUncompressedHex, predecessor, path) => {
  const root = secp256k1.Point.fromHex(rootUncompressedHex);
  const child = root.add(secp256k1.Point.BASE.multiply(deriveEpsilon(predecessor, path)));
  return child.toHex(false);
};

export const evmAddressFromPublicKey = (uncompressedHex) => {
  const xy = uncompressedHex.startsWith('04') ? uncompressedHex.slice(2) : uncompressedHex;
  return getAddress(`0x${keccak256(`0x${xy}`).slice(-40)}`);
};

/**
 * @param {object} p
 * @param {string} p.predecessor  NEAR account that calls `sign` (e.g. chinchinnn.near)
 * @param {string} [p.path]       derivation path; one path = one address on every EVM chain
 * @param {string} [p.mpcContract]
 */
export const deriveEvmAccount = ({ predecessor, path = DEFAULT_EVM_PATH, mpcContract = 'v1.signer' }) => {
  if (!predecessor) throw new Error('deriveEvmAccount: predecessor (NEAR account id) required');
  const rootNaj = MPC_ROOT_KEYS[mpcContract];
  if (!rootNaj) throw new Error(`no known root key for ${mpcContract}; fetch it via public_key view`);
  const publicKey = deriveChildPublicKey(najToUncompressedHex(rootNaj), predecessor, path);
  return { predecessor, path, mpcContract, publicKey, address: evmAddressFromPublicKey(publicKey) };
};
