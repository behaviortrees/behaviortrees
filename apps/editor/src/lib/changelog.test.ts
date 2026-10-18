import { beforeEach, describe, expect, it, vi } from 'vitest';

const memory = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, String(v)),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
} as Storage;

// The boot decision is cached per module instance, so load a fresh copy
async function boot() {
  vi.resetModules();
  const changelog = await import('./changelog');
  changelog.initWhatsNew();
  return changelog;
}

const storeProject = () =>
  memory.set('bt-project-p1', JSON.stringify({ scope: 'project', id: 'p1', trees: [] }));

beforeEach(() => memory.clear());

describe("what's new notice", () => {
  it('stays hidden for first-time visitors and marks them caught up', async () => {
    const { shouldShowWhatsNew, LATEST_RELEASE } = await boot();
    expect(shouldShowWhatsNew()).toBe(false);
    expect(memory.get('bt-whats-new-seen')).toBe(LATEST_RELEASE.id);
  });

  it('shows once for returning users', async () => {
    storeProject();
    const first = await boot();
    expect(first.shouldShowWhatsNew()).toBe(true);
    first.markWhatsNewSeen();
    expect(first.shouldShowWhatsNew()).toBe(false);

    const next = await boot();
    expect(next.shouldShowWhatsNew()).toBe(false);
  });

  it('shows again for the next release', async () => {
    storeProject();
    memory.set('bt-whats-new-seen', '2000-01-01');
    expect((await boot()).shouldShowWhatsNew()).toBe(true);
  });
});
