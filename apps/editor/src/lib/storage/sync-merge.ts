// Pure merge logic for cloud sync: given the state of each project on this
// device and in the cloud, plus the last-synced watermark, decide what to do.
// Kept free of I/O so it can be unit tested exhaustively.

export type SideState = {
  updatedAt: string;
  // Soft-deleted (cloud tombstone row / local bt-deleted-* marker)
  deleted: boolean;
};

export type MergeInput = {
  local: Record<string, SideState>;
  cloud: Record<string, SideState>;
  // project id -> updatedAt at last successful sync
  lastSynced: Record<string, string>;
};

export type MergeActions = {
  pull: string[];
  push: string[];
  deleteLocal: string[];
  deleteRemote: string[];
  // Both sides changed since last sync and neither is a deletion; the executor
  // keeps the newer copy under the id and preserves the older as a duplicate.
  conflicts: { id: string; winner: 'local' | 'cloud' }[];
  // Ids whose state is already reconciled; record their updatedAt as synced
  inSync: string[];
  // Local tombstones that no longer need to exist (delete already propagated)
  clearTombstones: string[];
};

const time = (iso: string | undefined): number => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? 0 : t;
};

export function mergeProjects(input: MergeInput): MergeActions {
  const actions: MergeActions = {
    pull: [],
    push: [],
    deleteLocal: [],
    deleteRemote: [],
    conflicts: [],
    inSync: [],
    clearTombstones: [],
  };

  const ids = new Set([...Object.keys(input.local), ...Object.keys(input.cloud)]);

  ids.forEach((id) => {
    const local = input.local[id];
    const cloud = input.cloud[id];
    const synced = input.lastSynced[id];

    if (local && !cloud) {
      // Never reached the cloud
      if (local.deleted) {
        actions.clearTombstones.push(id);
      } else {
        actions.push.push(id);
      }
      return;
    }

    if (cloud && !local) {
      if (cloud.deleted) {
        actions.inSync.push(id);
      } else {
        actions.pull.push(id);
      }
      return;
    }

    if (!local || !cloud) return;

    const localChanged = !synced || time(local.updatedAt) !== time(synced);
    const cloudChanged = !synced || time(cloud.updatedAt) !== time(synced);

    if (local.deleted && cloud.deleted) {
      actions.clearTombstones.push(id);
      return;
    }

    if (!localChanged && !cloudChanged) {
      actions.inSync.push(id);
      return;
    }

    if (localChanged && !cloudChanged) {
      if (local.deleted) actions.deleteRemote.push(id);
      else actions.push.push(id);
      return;
    }

    if (!localChanged && cloudChanged) {
      if (cloud.deleted) actions.deleteLocal.push(id);
      else actions.pull.push(id);
      return;
    }

    // Both changed since last sync
    if (time(local.updatedAt) === time(cloud.updatedAt)) {
      // Identical timestamps: same edit arrived via another path
      if (local.deleted) actions.clearTombstones.push(id);
      else actions.inSync.push(id);
      return;
    }

    // A deletion racing an edit: the edit wins — a deletion has no content to
    // lose, while dropping the edit would
    if (local.deleted) {
      actions.pull.push(id);
      actions.clearTombstones.push(id);
      return;
    }
    if (cloud.deleted) {
      actions.push.push(id);
      return;
    }

    actions.conflicts.push({
      id,
      winner: time(local.updatedAt) > time(cloud.updatedAt) ? 'local' : 'cloud',
    });
  });

  return actions;
}
