import type { VercelRequest, VercelResponse } from './_lib/http.js';

// ChatGPT app directory domain verification, served at
// /.well-known/openai-apps-challenge (rewritten here by vercel.json). OpenAI
// shows the token when the MCP server is connected in its submission portal;
// set it as the OPENAI_APPS_CHALLENGE environment variable in Vercel.
export default function handler(_req: VercelRequest, res: VercelResponse) {
  const token = process.env.OPENAI_APPS_CHALLENGE?.trim();
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (!token) {
    res.status(404).send('Not found');
    return;
  }
  res.status(200).send(token);
}
