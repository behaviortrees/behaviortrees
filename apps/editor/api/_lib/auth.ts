import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from '@clerk/backend';

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
    const payload = await verifyToken(header.slice('Bearer '.length), { secretKey });
    return payload.sub;
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }
}
