import { NearIntentsClient } from './providers/near-intents.js';

const c = new NearIntentsClient();
const tokens = await c.getTokens();
console.log('Supported tokens:', tokens.length);

const from = c.findAsset(tokens, 'USDC', 'base');
const to = c.findAsset(tokens, 'USDC', 'arb');
console.log('from:', from?.assetId);
console.log('to:', to?.assetId);

if (from && to) {
  const quote = await c.dryQuote({
    from,
    to,
    amountHuman: 5,
    refundTo: '0x2D571f7199B1C8ec95FDF46Aff0Dd4C6F99C461d',
    recipient: '0x2D571f7199B1C8ec95FDF46Aff0Dd4C6F99C461d',
  });
  console.log(JSON.stringify(quote, null, 2));
}