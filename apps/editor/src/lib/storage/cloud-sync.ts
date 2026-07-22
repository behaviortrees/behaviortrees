import { create } from 'zustand';
import { toast } from 'sonner';
import { B3Project, parseImportedJson } from '../behavior/b3';
import {
  ApiError,
  deleteProjectRemote,
  fetchProject,
  fetchProjectList,
  putProject,
  setTokenGetter,
} from '../api-client';
import {
  clearTombstone,
  getSyncState,
  listLocalProjects,
  listTombstones,
  readLocalProject,
  removeLocalProject,
  setSyncState,
  subscribeLocalProjects,
  writeLocalProject,
} from './local-projects';
import { mergeProjects, SideState } from './sync-merge';
import { useProjectStore } from '../../stores/useProjectStore';

// Cloud sync engine. Started/stopped by CloudSyncController when the Clerk
// session appears/disappears; observes the local storage module and mirrors
// changes to the API, and runs a full merge on start and on reconnect.

const PUSH_DEBOUNCE_MS = 2000;

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

type SyncStoreState = {
  status: SyncStatus;
  lastSyncedAt: string | null;
  // Bumped whenever sync changes local data, so lists can re-read storage
  localRevision: number;
};

export const useSyncStore = create<SyncStoreState>(() => ({
  status: 'idle',
  lastSyncedAt: null,
  localRevision: 0,
}));

const setStatus = (status: SyncStatus) => {
  useSyncStore.setState(
    status === 'synced'
      ? { status, lastSyncedAt: new Date().toISOString() }
      : { status }
  );
};

const bumpLocalRevision = () => {
  useSyncStore.setState((state) => ({ localRevision: state.localRevision + 1 }));
};

let active = false;
let unsubscribe: (() => void) | null = null;
let onlineListener: (() => void) | null = null;
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();

const isOffline = (error: unknown): boolean =>
  error instanceof TypeError || (typeof navigator !== 'undefined' && !navigator.onLine);

function recordSynced(id: string, updatedAt: string | null) {
  const state = getSyncState();
  if (updatedAt === null) delete state[id];
  else state[id] = updatedAt;
  setSyncState(state);
}

async function pushProject(id: string): Promise<void> {
  const project = readLocalProject(id);
  if (!project) return;
  await putProject(project);
  recordSynced(id, project.updatedAt ?? new Date().toISOString());
}

function schedulePush(id: string) {
  if (!active) return;
  const existing = pushTimers.get(id);
  if (existing) clearTimeout(existing);
  pushTimers.set(
    id,
    setTimeout(() => {
      pushTimers.delete(id);
      void flushPush(id);
    }, PUSH_DEBOUNCE_MS)
  );
}

async function flushPush(id: string) {
  if (!active) return;
  setStatus('syncing');
  try {
    await pushProject(id);
    setStatus('synced');
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      // Another device pushed newer data; reconcile instead of overwriting
      await fullSync();
      return;
    }
    if (isOffline(error)) {
      setStatus('offline');
    } else {
      console.error('Cloud push failed', error);
      setStatus('error');
    }
  }
}

async function pushDelete(id: string, deletedAt: string) {
  if (!active) return;
  setStatus('syncing');
  try {
    await deleteProjectRemote(id, deletedAt);
    clearTombstone(id);
    recordSynced(id, null);
    setStatus('synced');
  } catch (error) {
    if (isOffline(error)) {
      setStatus('offline');
    } else {
      console.error('Cloud delete failed', error);
      setStatus('error');
    }
  }
}

// Reload the store if sync replaced (or removed) the project that is open
function refreshOpenProject(id: string) {
  const store = useProjectStore.getState();
  if (store.project?.id !== id) return;

  const payload = readLocalProject(id);
  if (!payload) {
    store.closeProject();
    return;
  }
  try {
    const imported = parseImportedJson(payload);
    if (imported.kind === 'project') store.loadProject(imported.project);
  } catch (error) {
    console.error('Failed to reload synced project', error);
  }
}

function duplicateAsConflictCopy(project: B3Project): B3Project {
  return {
    ...project,
    id: crypto.randomUUID(),
    name: `${project.name ?? 'Untitled'} (conflict copy)`,
    updatedAt: new Date().toISOString(),
  };
}

export async function fullSync(): Promise<void> {
  if (!active) return;
  setStatus('syncing');

  try {
    const cloudList = await fetchProjectList();

    const local: Record<string, SideState> = {};
    listLocalProjects().forEach((project) => {
      if (project.id) {
        local[project.id] = {
          updatedAt: project.updatedAt ?? new Date(0).toISOString(),
          deleted: false,
        };
      }
    });
    Object.entries(listTombstones()).forEach(([id, deletedAt]) => {
      local[id] = { updatedAt: deletedAt, deleted: true };
    });

    const cloud: Record<string, SideState> = {};
    cloudList.forEach((meta) => {
      cloud[meta.id] = { updatedAt: meta.updatedAt, deleted: meta.deletedAt !== null };
    });

    const actions = mergeProjects({ local, cloud, lastSynced: getSyncState() });
    let changedLocally = false;

    for (const id of actions.pull) {
      const project = await fetchProject(id);
      clearTombstone(id);
      writeLocalProject(project, { silent: true });
      recordSynced(id, project.updatedAt ?? cloud[id]?.updatedAt ?? null);
      refreshOpenProject(id);
      changedLocally = true;
    }

    for (const id of actions.push) {
      await pushProject(id);
    }

    for (const id of actions.deleteLocal) {
      removeLocalProject(id, { silent: true });
      recordSynced(id, null);
      refreshOpenProject(id);
      changedLocally = true;
    }

    for (const id of actions.deleteRemote) {
      await deleteProjectRemote(id, local[id]?.updatedAt ?? new Date().toISOString());
      clearTombstone(id);
      recordSynced(id, null);
    }

    for (const { id, winner } of actions.conflicts) {
      // Keep the newer copy under the project id; preserve the older side as a
      // separate "(conflict copy)" project so nothing is silently lost.
      const loser =
        winner === 'cloud' ? readLocalProject(id) : await fetchProject(id);
      if (winner === 'cloud') {
        const project = await fetchProject(id);
        writeLocalProject(project, { silent: true });
        recordSynced(id, project.updatedAt ?? null);
        refreshOpenProject(id);
      } else {
        await pushProject(id);
      }
      if (loser) {
        const copy = duplicateAsConflictCopy(loser);
        writeLocalProject(copy, { silent: true });
        await pushProject(copy.id!);
      }
      changedLocally = true;
      toast.warning(`"${loser?.name ?? id}" changed on two devices`, {
        description: 'Kept the newest version and saved the other as a conflict copy.',
      });
    }

    for (const id of actions.inSync) {
      const updatedAt = cloud[id]?.updatedAt ?? local[id]?.updatedAt;
      if (updatedAt) recordSynced(id, updatedAt);
    }

    for (const id of actions.clearTombstones) {
      clearTombstone(id);
      recordSynced(id, null);
    }

    if (changedLocally) bumpLocalRevision();
    setStatus('synced');
  } catch (error) {
    if (isOffline(error)) {
      setStatus('offline');
    } else {
      console.error('Cloud sync failed', error);
      setStatus('error');
    }
  }
}

export function startCloudSync(getToken: () => Promise<string | null>): void {
  if (active) return;
  active = true;
  setTokenGetter(getToken);

  unsubscribe = subscribeLocalProjects((event) => {
    if (event.type === 'write' && event.project.id) {
      schedulePush(event.project.id);
    } else if (event.type === 'remove') {
      void pushDelete(event.id, event.deletedAt);
    }
  });

  onlineListener = () => void fullSync();
  window.addEventListener('online', onlineListener);

  void fullSync();
}

export function stopCloudSync(): void {
  if (!active) return;
  active = false;
  setTokenGetter(null);
  unsubscribe?.();
  unsubscribe = null;
  if (onlineListener) {
    window.removeEventListener('online', onlineListener);
    onlineListener = null;
  }
  pushTimers.forEach((timer) => clearTimeout(timer));
  pushTimers.clear();
  useSyncStore.setState({ status: 'idle' });
}
