import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from '../_lib/auth.js';
import { getProject, softDeleteProject, upsertProject } from '../_lib/db.js';
import { MAX_PAYLOAD_BYTES, validateProjectPayload } from '../_lib/validate.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = await requireUser(req, res);
  if (!userId) return;

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) {
    res.status(400).json({ error: 'Missing project id' });
    return;
  }

  try {
    switch (req.method) {
      case 'GET': {
        const data = await getProject(userId, id);
        if (data === null) {
          res.status(404).json({ error: 'Project not found' });
          return;
        }
        res.status(200).json({ project: data });
        return;
      }

      case 'PUT': {
        const contentLength = Number(req.headers['content-length'] ?? 0);
        if (contentLength > MAX_PAYLOAD_BYTES) {
          res.status(413).json({ error: 'Project exceeds the 2 MB sync limit' });
          return;
        }

        const validated = validateProjectPayload(req.body?.data);
        if (!validated.ok) {
          res.status(400).json({ error: validated.error });
          return;
        }
        if (validated.project.id !== id) {
          res.status(400).json({ error: 'Payload id does not match URL' });
          return;
        }

        const stored = await upsertProject(
          userId,
          id,
          validated.project.name,
          validated.project,
          validated.project.updatedAt
        );
        if (!stored) {
          // A newer version already exists (stale tab / another device)
          res.status(409).json({ error: 'A newer version of this project exists' });
          return;
        }
        res.status(200).json({ updatedAt: validated.project.updatedAt });
        return;
      }

      case 'DELETE': {
        const deletedAtRaw = req.body?.deletedAt;
        const deletedAt =
          typeof deletedAtRaw === 'string' && !Number.isNaN(Date.parse(deletedAtRaw))
            ? deletedAtRaw
            : new Date().toISOString();
        await softDeleteProject(userId, id, deletedAt);
        res.status(200).json({ deletedAt });
        return;
      }

      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error(`Failed to ${req.method} project`, error);
    res.status(500).json({ error: 'Request failed' });
  }
}
