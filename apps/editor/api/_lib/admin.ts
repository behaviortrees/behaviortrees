import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from './auth.js';

// Admin access is an env allowlist of Clerk user ids. Non-admins get a 404
// (not 403) so the endpoint's existence isn't advertised.
export async function requireAdmin(
  req: VercelRequest,
  res: VercelResponse
): Promise<string | null> {
  const userId = await requireUser(req, res);
  if (!userId) return null;

  const allowed = (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (!allowed.includes(userId)) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }

  return userId;
}
