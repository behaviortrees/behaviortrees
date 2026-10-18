import type { VercelRequest, VercelResponse } from './_lib/http.js';
import { upsertCommercialInterest } from './_lib/db.js';
import { validateCommercialInterest } from './_lib/interest-validate.js';

const MAX_REQUEST_BYTES = 8 * 1024;
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;

// Best-effort throttle: state lives on warm lambdas only (same trade-off as
// the admin dashboard cache), which is enough to blunt naive spam.
const recentByIp = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  if (recentByIp.size > 5000) recentByIp.clear();
  const hits = (recentByIp.get(ip) ?? []).filter((at) => now - at < RATE_WINDOW_MS);
  if (hits.length >= RATE_LIMIT) {
    recentByIp.set(ip, hits);
    return true;
  }
  hits.push(now);
  recentByIp.set(ip, hits);
  return false;
}

function clientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return first?.split(',')[0]?.trim() || 'unknown';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (isRateLimited(clientIp(req))) {
    res.status(429).json({ error: 'Too many requests, please try again later' });
    return;
  }

  const contentLength = Number(req.headers['content-length'] ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    res.status(413).json({ error: 'Request is too large' });
    return;
  }

  const validated = validateCommercialInterest(req.body);
  if (!validated.ok) {
    res.status(400).json({ error: validated.error });
    return;
  }

  // A filled hidden field is almost certainly a bot. Return the same generic
  // success response so the endpoint does not teach bots how to bypass it.
  if (validated.interest.website) {
    res.status(200).json({ received: true });
    return;
  }

  try {
    await upsertCommercialInterest(validated.interest);
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Failed to store commercial interest', error);
    res.status(500).json({ error: 'Could not save your request' });
  }
}
