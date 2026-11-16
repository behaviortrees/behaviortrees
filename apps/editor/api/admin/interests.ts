import type { VercelRequest, VercelResponse } from '../_lib/http.js';
import { requireAdmin } from '../_lib/admin.js';
import { setCommercialInterestStatus } from '../_lib/db.js';
import { parseInterestStatusUpdate } from '../_lib/interest-validate.js';

// Marks an early-access request as new, reviewed or replied
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const userId = await requireAdmin(req, res);
  if (!userId) return;

  res.setHeader('Cache-Control', 'no-store');
  const update = parseInterestStatusUpdate(req.body);
  if (!update) {
    res.status(400).json({ error: 'Expected an id and a status of new, reviewed or replied' });
    return;
  }

  try {
    const statusUpdatedAt = await setCommercialInterestStatus(update.id, update.status);
    if (!statusUpdatedAt) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }
    res.status(200).json({ id: update.id, status: update.status, statusUpdatedAt });
  } catch (error) {
    console.error('Failed to update early-access request status', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
}
