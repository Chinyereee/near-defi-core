export type ChainKey = 'ethereum' | 'polygon' | 'base';
export type FeedStatus = 'ONLINE' | 'STALE' | 'OFFLINE';

export type Holding = {
  owner: string;
  kind: 'native' | 'erc20';
  symbol: string;
  token: string | null;
  decimals: number;
  raw: string;
  amount: string;
  usd: number | null;
  ok: boolean;
};

export type ChainBalances = {
  status: FeedStatus;
  holdings: Holding[];
  totalUsd: number;
  updatedAt: string | null;
  tokenSource?: '1click' | 'fallback';
  failedCalls?: number;
  error?: string;
};

export type GasReading = { gasGwei: string | null; gwei: number | null; status: FeedStatus; updatedAt: string | null };

export type StateResponse = {
  account: {
    nearAccountId: string;
    path: string;
    evmAddress: string;
    mpcContract: string;
    near: { exists?: boolean; near?: string; error?: string } | null;
  };
  chains: Record<ChainKey, { name: string; chainId: number; nativeSymbol: string }>;
  gas: Record<ChainKey, GasReading>;
  balances: { chains: Record<ChainKey, ChainBalances>; totalUsd: number; pricedFully: boolean };
  nearNetwork: { network: string; blockHeight?: number; status: string; error?: string };
  serverTime: string;
};

export type RouteQuote = {
  id: string;
  fromChain: ChainKey;
  fromSymbol: string;
  toChain: ChainKey;
  toSymbol: string;
  status: 'ok' | 'error';
  error?: string;
  amountIn?: string | null;
  amountInUsd?: number | null;
  amountOut?: string | null;
  amountOutUsd?: number | null;
  minAmountOut?: string | null;
  timeEstimateSec?: number | null;
  routeFeeUsd?: number | null;
  depositGasUsd?: number | null;
  netUsd?: number | null;
  best?: boolean;
};

export type RoutesResponse = {
  request: { from: ChainKey; symbol: string; amount: string };
  gas: { chain: ChainKey; gwei: number | null; nativeSymbol: string; nativeUsd: number | null; units: number };
  routes: RouteQuote[];
  quotedAt: string;
  stale: boolean;
};
