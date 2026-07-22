import { B3Project } from '../behavior/b3';

// Every localStorage touch for project data goes through this module so that
// cloud sync has a single choke-point to observe. Writes/removes notify
// subscribers (the sync engine) unless flagged as originating from the cloud.

const PROJECT_KEY_PREFIX = 'bt-project-';
const CURRENT_PROJECT_KEY = 'bt-current-project';
const TOMBSTONE_KEY_PREFIX = 'bt-deleted-';
const SYNC_STATE_KEY = 'bt-sync-state';

const storage = (): Storage | null =>
  typeof localStorage === 'undefined' ? null : localStorage;

export type LocalProjectEvent =
  | { type: 'write'; project: B3Project }
  | { type: 'remove'; id: string; deletedAt: string };

type Listener = (event: LocalProjectEvent) => void;

const listeners = new Set<Listener>();

export function subscribeLocalProjects(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(event: LocalProjectEvent) {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      console.error('Local project listener failed', error);
    }
  });
}

export function listLocalProjects(): B3Project[] {
  const store = storage();
  if (!store) return [];

  const projects: B3Project[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (!key || !key.startsWith(PROJECT_KEY_PREFIX)) continue;
    try {
      const parsed = JSON.parse(store.getItem(key) ?? '') as B3Project;
      if (parsed && typeof parsed === 'object') {
        // Older saves may predate the id field; the key is authoritative
        parsed.id = parsed.id ?? key.slice(PROJECT_KEY_PREFIX.length);
        projects.push(parsed);
      }
    } catch (error) {
      console.error('Error parsing project from localStorage:', error);
    }
  }
  return projects;
}

export function readLocalProject(id: string): B3Project | null {
  const raw = storage()?.getItem(`${PROJECT_KEY_PREFIX}${id}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as B3Project;
  } catch (error) {
    console.error('Error parsing project from localStorage:', error);
    return null;
  }
}

export function writeLocalProject(
  project: B3Project,
  options?: { silent?: boolean }
): void {
  const store = storage();
  if (!store || !project.id) return;
  store.setItem(`${PROJECT_KEY_PREFIX}${project.id}`, JSON.stringify(project));
  store.removeItem(`${TOMBSTONE_KEY_PREFIX}${project.id}`);
  if (!options?.silent) {
    notify({ type: 'write', project });
  }
}

export function removeLocalProject(
  id: string,
  options?: { silent?: boolean }
): void {
  const store = storage();
  if (!store) return;
  const deletedAt = new Date().toISOString();
  store.removeItem(`${PROJECT_KEY_PREFIX}${id}`);
  if (options?.silent) {
    store.removeItem(`${TOMBSTONE_KEY_PREFIX}${id}`);
  } else {
    // Tombstone so a signed-in session can propagate the delete to the cloud,
    // even if it happens after a reload
    store.setItem(`${TOMBSTONE_KEY_PREFIX}${id}`, deletedAt);
    notify({ type: 'remove', id, deletedAt });
  }
}

export function listTombstones(): Record<string, string> {
  const store = storage();
  if (!store) return {};
  const tombstones: Record<string, string> = {};
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (!key || !key.startsWith(TOMBSTONE_KEY_PREFIX)) continue;
    const deletedAt = store.getItem(key);
    if (deletedAt) tombstones[key.slice(TOMBSTONE_KEY_PREFIX.length)] = deletedAt;
  }
  return tombstones;
}

export function clearTombstone(id: string): void {
  storage()?.removeItem(`${TOMBSTONE_KEY_PREFIX}${id}`);
}

export function getCurrentProjectId(): string | null {
  return storage()?.getItem(CURRENT_PROJECT_KEY) ?? null;
}

export function setCurrentProjectId(id: string): void {
  storage()?.setItem(CURRENT_PROJECT_KEY, id);
}

export function clearCurrentProjectId(): void {
  storage()?.removeItem(CURRENT_PROJECT_KEY);
}

// Map of project id -> updatedAt at the moment it was last synced with the
// cloud. Used to tell "changed on one side" from "changed on both" (conflict).
export function getSyncState(): Record<string, string> {
  const raw = storage()?.getItem(SYNC_STATE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function setSyncState(state: Record<string, string>): void {
  storage()?.setItem(SYNC_STATE_KEY, JSON.stringify(state));
}
