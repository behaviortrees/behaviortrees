import { B3Project } from './behavior/b3';

// Thin fetch wrapper for the sync API. The Clerk token getter is registered at
// runtime (from a component inside ClerkProvider) and fetched per request so
// tokens are always fresh.

export type CloudProjectMeta = {
  id: string;
  name: string;
  updatedAt: string;
  deletedAt: string | null;
};

type TokenGetter = () => Promise<string | null>;

let getToken: TokenGetter | null = null;

export function setTokenGetter(getter: TokenGetter | null): void {
  getToken = getter;
}

export function hasTokenGetter(): boolean {
  return getToken !== null;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!getToken) throw new ApiError(401, 'Not signed in');
  const token = await getToken();
  if (!token) throw new ApiError(401, 'Not signed in');

  const response = await fetch(path, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      // Non-JSON error body; keep the status text
    }
    throw new ApiError(response.status, message);
  }

  return response.json() as Promise<T>;
}

export async function fetchProjectList(): Promise<CloudProjectMeta[]> {
  const body = await request<{ projects: CloudProjectMeta[] }>('/api/projects');
  return body.projects;
}

export async function fetchProject(id: string): Promise<B3Project> {
  const body = await request<{ project: B3Project }>(
    `/api/projects/${encodeURIComponent(id)}`
  );
  return body.project;
}

export async function putProject(project: B3Project): Promise<void> {
  await request(`/api/projects/${encodeURIComponent(project.id ?? '')}`, {
    method: 'PUT',
    body: JSON.stringify({ data: project }),
  });
}

export async function deleteProjectRemote(id: string, deletedAt: string): Promise<void> {
  await request(`/api/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    body: JSON.stringify({ deletedAt }),
  });
}
