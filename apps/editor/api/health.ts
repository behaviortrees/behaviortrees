import type { VercelRequest, VercelResponse } from '@vercel/node';

// Smoke test that functions are routed ahead of the SPA catch-all rewrite:
// /api/health must return JSON, never index.html.
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: true });
}
