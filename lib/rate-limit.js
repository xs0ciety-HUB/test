// Shared rate limiting for Vercel functions. Configure KV_REST_API_URL and
// KV_REST_API_TOKEN (Upstash Redis REST) for cross-instance enforcement.
const localBuckets = new Map();

function clientKey(req) {
  // Vercel supplies x-forwarded-for; use only the first address.
  const forwarded = req.headers?.['x-forwarded-for'];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : String(forwarded || '')).split(',')[0].trim();
  return (ip || 'unknown').slice(0, 80).replace(/[^a-zA-Z0-9:._-]/g, '_');
}

export async function enforceRateLimit(req, res, { name, limit = 60, windowSeconds = 60 } = {}) {
  const key = clientKey(req);
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  let count;
  if (url && token) {
    const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
    const redisKey = `soundpulse:rl:${name}:${key}:${bucket}`;
    try {
      const r = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([['INCR', redisKey], ['EXPIRE', redisKey, windowSeconds + 5]])
      });
      const data = await r.json();
      if (!r.ok || !Array.isArray(data) || !data[0] || data[0].error) throw new Error('KV rate-limit request failed');
      count = Number(data[0].result);
    } catch (err) {
      console.error('[rate-limit] shared backend unavailable', err.message);
      res.setHeader('Retry-After', String(windowSeconds));
      res.status(503).json({ error: 'Rate limit service temporarily unavailable' });
      return false;
    }
  } else {
    // Best effort only. This fallback is not globally consistent on serverless.
    const now = Date.now();
    const k = `${name}:${key}`;
    const entry = localBuckets.get(k);
    if (!entry || now - entry.start >= windowSeconds * 1000) {
      localBuckets.set(k, { start: now, count: 1 });
      count = 1;
    } else {
      count = ++entry.count;
    }
    if (localBuckets.size > 5000) localBuckets.clear();
  }
  res.setHeader('RateLimit-Limit', String(limit));
  res.setHeader('RateLimit-Remaining', String(Math.max(0, limit - count)));
  if (count > limit) {
    res.setHeader('Retry-After', String(windowSeconds));
    res.status(429).json({ error: 'Terlalu banyak request, coba lagi nanti' });
    return false;
  }
  return true;
}
