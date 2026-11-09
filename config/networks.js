import dotenv from 'dotenv';
dotenv.config();

export const nearConfig = {
  networkId: 'testnet',
  nodeUrl: process.env.NEAR_RPC_URL || 'https://near.org',
  walletUrl: 'https://mynearwallet.com',
  helperUrl: 'https://near.org'
};

export const evmConfig = {
  ethereum: {
    id: 1,
    name: 'Ethereum',
    rpcUrl: process.env.ETH_RPC_URL
  },
  polygon: {
    id: 137,
    name: 'Polygon',
    rpcUrl: process.env.POLYGON_RPC_URL
  },
  base: {
    id: 8453,
    name: 'Base',
    rpcUrl: process.env.BASE_RPC_URL
  }
};
