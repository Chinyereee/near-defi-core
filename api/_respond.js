// api/_respond.js  (underscore: Vercel does not expose it as a route)
// Success responses are cached by Vercel's CDN for 15s and served stale for
// up to 45s more while one background call refreshes them, so N viewers
// polling = ~1 upstream fan-out per window, not N. Errors are never cached.
export async function respond(res, work) {
  try {
    const body = await work();
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=15, stale-while-revalidate=45');
    res.status(200).json(body);
  } catch (err) {
    console.error('[api]', err.message);
    res.setHeader('Cache-Control', 'no-store');
    res.status(err.status || 500).json({ error: err.message });
  }
}
