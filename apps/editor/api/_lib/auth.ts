import type { VercelRequest, VercelResponse } from './http.js';
import { verifyToken } from '@clerk/backend';

// Clerk stamps each session token with the origin it was issued to (azp).
// Only tokens issued for the origin serving this request are accepted, so a
// token minted on a preview or dev deployment of the same Clerk instance
// can't be replayed against production. CLERK_AUTHORIZED_PARTIES overrides
// the list for setups where the API host differs from the app origin.
function authorizedParties(req: VercelRequest): string[] {
  const configured = process.env.CLERK_AUTHORIZED_PARTIES;
  if (configured) {
    return configured
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }
  const host = req.headers.host;
  return host ? [`https://${host}`, `http://${host}`] : [];
}

// Verifies the Clerk session token from the Authorization header. Bearer-only
// (no cookies) keeps the API CSRF-immune; the SPA attaches the token per
// request via getToken().
export async function requireUser(
  req: VercelRequest,
  res: VercelResponse
): Promise<string | null> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    res.status(500).json({ error: 'CLERK_SECRET_KEY is not configured' });
    return null;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing bearer token' });
    return null;
  }

  try {
    const payload = await verifyToken(header.slice('Bearer '.length), {
      secretKey,
      authorizedParties: authorizedParties(req),
    });
    return payload.sub;
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }
}
