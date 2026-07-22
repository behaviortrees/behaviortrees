import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClerkClient } from '@clerk/backend';
import { requireAdmin } from '../_lib/admin.js';
import { getProjectTotals, listLatestProjectsAllUsers } from '../_lib/db.js';
import {
  fetchPlausibleStats,
  fetchPostHogStats,
  type PlausibleStats,
  type PostHogStats,
} from '../_lib/analytics-sources.js';

type SectionError = { error: string };

type ProjectsSection = {
  totalActive: number;
  totalUsers: number;
  latest: {
    id: string;
    userId: string;
    userName: string | null;
    userEmail: string | null;
    name: string;
    updatedAt: string;
    createdAt: string;
  }[];
};

export type AdminDashboardResponse = {
  generatedAt: string;
  cached: boolean;
  plausible: PlausibleStats | SectionError;
  posthog: PostHogStats | SectionError;
  projects: ProjectsSection | SectionError;
};

// In-memory cache survives on warm lambdas only, which is enough to keep
// rapid refreshes from hammering the external APIs.
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { at: number; body: AdminDashboardResponse } | null = null;

async function fetchProjectsSection(): Promise<ProjectsSection> {
  const [latest, totals] = await Promise.all([
    listLatestProjectsAllUsers(20),
    getProjectTotals(),
  ]);

  const users = new Map<string, { name: string | null; email: string | null }>();
  const distinctIds = [...new Set(latest.map((row) => row.user_id))];
  if (distinctIds.length > 0) {
    try {
      const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
      const list = await clerk.users.getUserList({
        userId: distinctIds,
        limit: distinctIds.length,
      });
      for (const user of list.data) {
        const name =
          [user.firstName, user.lastName].filter(Boolean).join(' ') || null;
        const email = user.primaryEmailAddress?.emailAddress ?? null;
        users.set(user.id, { name, email });
      }
    } catch (error) {
      console.error('Failed to resolve users via Clerk', error);
    }
  }

  return {
    totalActive: totals.totalActive,
    totalUsers: totals.totalUsers,
    latest: latest.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userName: users.get(row.user_id)?.name ?? null,
      userEmail: users.get(row.user_id)?.email ?? null,
      name: row.name,
      updatedAt: row.updated_at,
      createdAt: row.created_at,
    })),
  };
}

function settled<T>(result: PromiseSettledResult<T>, label: string): T | SectionError {
  if (result.status === 'fulfilled') return result.value;
  console.error(`Admin dashboard: ${label} failed`, result.reason);
  const message = result.reason instanceof Error ? result.reason.message : 'Unknown error';
  return { error: message };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const userId = await requireAdmin(req, res);
  if (!userId) return;

  res.setHeader('Cache-Control', 'no-store');

  const fresh = req.query.fresh === '1';
  if (!fresh && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    res.status(200).json({ ...cache.body, cached: true });
    return;
  }

  const [plausible, posthog, projects] = await Promise.allSettled([
    fetchPlausibleStats(),
    fetchPostHogStats(),
    fetchProjectsSection(),
  ]);

  const body: AdminDashboardResponse = {
    generatedAt: new Date().toISOString(),
    cached: false,
    plausible: settled(plausible, 'plausible'),
    posthog: settled(posthog, 'posthog'),
    projects: settled(projects, 'projects'),
  };

  cache = { at: Date.now(), body };
  res.status(200).json(body);
}
