// server.js
// Local / long-running Node host for the API + built dashboard.
//   GET /api/state                                  account, gas, balances, NEAR
//   GET /api/routes?from=base&symbol=USDC&amount=10 1Click dry quotes, ranked
// Dev:  npm run dev    (this server on :8787 + Vite on :5173 with /api proxy)
// Prod: deploy to Vercel (api/*.js functions), or npm run build && npm run serve
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getState, getRoutes, routeParams, accountSummary } from './lib/api.js';

const PORT = Number(process.env.PORT || 8787);
const DIST = join(dirname(fileURLToPath(import.meta.url)), 'web', 'dist');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon', '.png': 'image/png' };

async function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const safe = normalize(urlPath).replace(/^([/\\])+/, '').replace(/^(\.\.[/\\])+/, '');
  for (const p of [join(DIST, safe), join(DIST, 'index.html')]) {
    if (!p.startsWith(DIST)) continue;
    try {
      const body = await readFile(p);
      res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
      return res.end(body);
    } catch {
      /* try next */
    }
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found. In development, open the Vite URL (npm run dev); for production run npm run build first.');
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'GET only' });
    if (url.pathname === '/api/state') return sendJson(res, 200, await getState());
    if (url.pathname === '/api/routes') {
      const q = Object.fromEntries(url.searchParams);
      return sendJson(res, 200, await getRoutes(routeParams(q)));
    }
    if (url.pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'unknown endpoint' });
    return serveStatic(req, res);
  } catch (err) {
    console.error(`[api] ${url.pathname}:`, err.message);
    return sendJson(res, err.status || 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`⚡ near-defi-core API on http://localhost:${PORT}`);
  console.log(`   ${accountSummary()}`);
});
