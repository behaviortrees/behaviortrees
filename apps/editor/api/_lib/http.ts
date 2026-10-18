import type { IncomingMessage, ServerResponse } from 'node:http';

// The request/response helpers Vercel's Node runtime adds to every function.
// Mirrors the VercelRequest/VercelResponse types from @vercel/node, kept here
// so that package (and its build-time dependency tree) isn't installed just
// for types.
export type VercelRequest = IncomingMessage & {
  query: Partial<Record<string, string | string[]>>;
  cookies: Partial<Record<string, string>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
};

export type VercelResponse = ServerResponse & {
  send: (body: unknown) => VercelResponse;
  json: (jsonBody: unknown) => VercelResponse;
  status: (statusCode: number) => VercelResponse;
  redirect: (statusOrUrl: string | number, url?: string) => VercelResponse;
};
