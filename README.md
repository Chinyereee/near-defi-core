\# NEAR DeFi Core



One NEAR account. Three EVM chains. Live balances and live routes, no network switching.



Built for the NEAR hackathon, Track 1: Unstoppable DeFi.



!\[Dashboard](docs/dashboard.png)



\## The problem



Money is scattered across chains. Each one needs its own wallet, its own gas, and its own tab. Moving it means guessing which route is cheapest.



\## What it does



\- Reads gas prices on Ethereum, Polygon and Base through public RPCs, with fallbacks so one dead node doesn't break the page.

\- Derives one EVM address from a NEAR account using Chain Signatures. The address is checked against the live `v1.signer` contract.

\- Reads token balances on all three chains with one Multicall3 call per chain.

\- Asks NEAR Intents (1Click API) for live swap quotes and ranks the routes by what you actually receive after fees and gas.



\## How NEAR Intents is used



\- `providers/near-intents.js` calls the 1Click `/v0/tokens` and `/v0/quote` endpoints.

\- Quotes are dry runs. No deposit address is created and no funds move.

\- `lib/api.js` combines each quote with live gas to work out the net value.



\## What works today



\- Live balances, gas and quotes in the dashboard.

\- Derived address verified against the signer contract: `npm run verify:derivation`.

\- Quote ranking across Polygon, Ethereum and Base for USDC and USDT.



\## What is not built yet



\- Signing and sending a swap. The review step is a preview.

\- Yield. This is a router, not a yield product.



\## Run it



```bash

npm install

```



Create a `.env` file:



```

NEAR\_ACCOUNT\_ID=your-account.near

```



```bash

npm run dev

```



Open the Vite address it prints, usually `http://localhost:5173`.



\## Stack



React, Vite, TypeScript, viem, near-api-js, NEAR Intents 1Click API, a small Node API.



\## Prior work



The route ranking comes from the math in my flash loan arbitrage router: \[https://github.com/Chinyereee/flash-loan-arbitrage]. Flash loans are atomic on one chain, so only the comparison logic carried over. The NEAR Intents integration, the Chain Signatures address and the dashboard were built for this hackathon.



\## Author



Chinyere John-Nnah. \[Twitter/X](https://x.com/Nera\_of\_Web3)

