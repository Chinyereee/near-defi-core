// config/networks.js
// Single source of truth for every network the app talks to.
// RPC lists are ordered: env override first, then public fallbacks.
// Comma-separate multiple URLs in env, e.g. BASE_RPC_URL=https://a,https://b
import 'dotenv/config';
import { mainnet, polygon, base } from 'viem/chains';

const rpcList = (envVar, defaults) => {
  const fromEnv = (process.env[envVar] || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...fromEnv, ...defaults])];
};

export const EVM_CHAINS = {
  ethereum: {
    chain: mainnet,
    intentsId: 'eth', // `blockchain` value in the 1Click token list
    nativeSymbol: 'ETH',
    rpcUrls: rpcList('ETH_RPC_URL', [
      'https://ethereum-rpc.publicnode.com',
      'https://eth.llamarpc.com',
    ]),
  },
  polygon: {
    chain: polygon,
    intentsId: 'pol',
    nativeSymbol: 'POL',
    rpcUrls: rpcList('POLYGON_RPC_URL', [
      'https://polygon-bor-rpc.publicnode.com',
      'https://polygon.llamarpc.com',
    ]),
  },
  base: {
    chain: base,
    intentsId: 'base',
    nativeSymbol: 'ETH',
    rpcUrls: rpcList('BASE_RPC_URL', [
      'https://base-rpc.publicnode.com',
      'https://mainnet.base.org',
    ]),
  },
};

// NEAR Intents has no testnet, so the whole app runs on mainnet.
const NEAR_NETWORK = process.env.NEAR_NETWORK || 'mainnet';
export const NEAR_CONFIG = {
  networkId: NEAR_NETWORK,
  // Tried in order; a node that errors at the HTTP level is skipped.
  rpcUrls: rpcList(
    'NEAR_RPC_URL',
    NEAR_NETWORK === 'mainnet'
      ? ['https://rpc.mainnet.fastnear.com', 'https://near.lava.build', 'https://rpc.mainnet.near.org']
      : ['https://test.rpc.fastnear.com', 'https://neart.lava.build', 'https://rpc.testnet.near.org']
  ),
  mpcContract: NEAR_NETWORK === 'mainnet' ? 'v1.signer' : 'v1.signer-prod.testnet',
};

export const ONE_CLICK_BASE_URL =
  process.env.ONE_CLICK_BASE_URL || 'https://1click.chaindefuser.com';
