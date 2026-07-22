import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from '../_lib/auth.js';
import { listProjects } from '../_lib/db.js';

// GET /api/projects — metadata only (the sync diff endpoint). Full payloads
// are fetched per project via /api/projects/:id.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const userId = await requireUser(req, res);
  if (!userId) return;

  try {
    const rows = await listProjects(userId);
    res.status(200).json({
      projects: rows.map((row) => ({
        id: row.id,
        name: row.name,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at,
      })),
    });
  } catch (error) {
    console.error('Failed to list projects', error);
    res.status(500).json({ error: 'Failed to list projects' });
  }
}
