import { describe, expect, it } from 'vitest';
import { mergeProjects, MergeInput } from './sync-merge';

const t1 = '2026-01-01T00:00:00.000Z';
const t2 = '2026-01-02T00:00:00.000Z';
const t3 = '2026-01-03T00:00:00.000Z';

const merge = (input: Partial<MergeInput>) =>
  mergeProjects({ local: {}, cloud: {}, lastSynced: {}, ...input });

describe('mergeProjects', () => {
  it('pushes local-only projects', () => {
    const actions = merge({ local: { a: { updatedAt: t1, deleted: false } } });
    expect(actions.push).toEqual(['a']);
    expect(actions.pull).toEqual([]);
  });

  it('clears tombstones for deletes that never reached the cloud', () => {
    const actions = merge({ local: { a: { updatedAt: t1, deleted: true } } });
    expect(actions.clearTombstones).toEqual(['a']);
    expect(actions.deleteRemote).toEqual([]);
  });

  it('pulls cloud-only projects', () => {
    const actions = merge({ cloud: { a: { updatedAt: t1, deleted: false } } });
    expect(actions.pull).toEqual(['a']);
  });

  it('ignores cloud tombstones with no local copy', () => {
    const actions = merge({ cloud: { a: { updatedAt: t1, deleted: true } } });
    expect(actions.pull).toEqual([]);
    expect(actions.deleteLocal).toEqual([]);
    expect(actions.inSync).toEqual(['a']);
  });

  it('does nothing when both sides are unchanged since last sync', () => {
    const actions = merge({
      local: { a: { updatedAt: t1, deleted: false } },
      cloud: { a: { updatedAt: t1, deleted: false } },
      lastSynced: { a: t1 },
    });
    expect(actions.inSync).toEqual(['a']);
    expect(actions.push).toEqual([]);
    expect(actions.pull).toEqual([]);
  });

  it('pushes when only local changed', () => {
    const actions = merge({
      local: { a: { updatedAt: t2, deleted: false } },
      cloud: { a: { updatedAt: t1, deleted: false } },
      lastSynced: { a: t1 },
    });
    expect(actions.push).toEqual(['a']);
  });

  it('pulls when only cloud changed', () => {
    const actions = merge({
      local: { a: { updatedAt: t1, deleted: false } },
      cloud: { a: { updatedAt: t2, deleted: false } },
      lastSynced: { a: t1 },
    });
    expect(actions.pull).toEqual(['a']);
  });

  it('propagates a local delete to the cloud', () => {
    const actions = merge({
      local: { a: { updatedAt: t2, deleted: true } },
      cloud: { a: { updatedAt: t1, deleted: false } },
      lastSynced: { a: t1 },
    });
    expect(actions.deleteRemote).toEqual(['a']);
  });

  it('propagates a cloud delete locally', () => {
    const actions = merge({
      local: { a: { updatedAt: t1, deleted: false } },
      cloud: { a: { updatedAt: t2, deleted: true } },
      lastSynced: { a: t1 },
    });
    expect(actions.deleteLocal).toEqual(['a']);
  });

  it('clears tombstones once both sides are deleted', () => {
    const actions = merge({
      local: { a: { updatedAt: t2, deleted: true } },
      cloud: { a: { updatedAt: t2, deleted: true } },
      lastSynced: { a: t1 },
    });
    expect(actions.clearTombstones).toEqual(['a']);
  });

  it('treats identical timestamps on both sides as in sync', () => {
    const actions = merge({
      local: { a: { updatedAt: t2, deleted: false } },
      cloud: { a: { updatedAt: t2, deleted: false } },
    });
    expect(actions.inSync).toEqual(['a']);
    expect(actions.conflicts).toEqual([]);
  });

  it('flags a conflict when both sides changed, newer side winning', () => {
    const actions = merge({
      local: { a: { updatedAt: t3, deleted: false } },
      cloud: { a: { updatedAt: t2, deleted: false } },
      lastSynced: { a: t1 },
    });
    expect(actions.conflicts).toEqual([{ id: 'a', winner: 'local' }]);

    const reversed = merge({
      local: { a: { updatedAt: t2, deleted: false } },
      cloud: { a: { updatedAt: t3, deleted: false } },
      lastSynced: { a: t1 },
    });
    expect(reversed.conflicts).toEqual([{ id: 'a', winner: 'cloud' }]);
  });

  it('lets an edit win over a racing delete', () => {
    // Deleted here, edited elsewhere -> pull the edit back
    const localDeleted = merge({
      local: { a: { updatedAt: t2, deleted: true } },
      cloud: { a: { updatedAt: t3, deleted: false } },
      lastSynced: { a: t1 },
    });
    expect(localDeleted.pull).toEqual(['a']);
    expect(localDeleted.clearTombstones).toEqual(['a']);

    // Edited here, deleted elsewhere -> push the edit (resurrects)
    const cloudDeleted = merge({
      local: { a: { updatedAt: t3, deleted: false } },
      cloud: { a: { updatedAt: t2, deleted: true } },
      lastSynced: { a: t1 },
    });
    expect(cloudDeleted.push).toEqual(['a']);
  });

  it('handles a first sync with disjoint projects on both sides', () => {
    const actions = merge({
      local: { a: { updatedAt: t1, deleted: false } },
      cloud: { b: { updatedAt: t2, deleted: false } },
    });
    expect(actions.push).toEqual(['a']);
    expect(actions.pull).toEqual(['b']);
  });

  it('treats invalid timestamps as epoch instead of throwing', () => {
    const actions = merge({
      local: { a: { updatedAt: 'not-a-date', deleted: false } },
      cloud: { a: { updatedAt: t1, deleted: false } },
    });
    expect(actions.conflicts).toEqual([{ id: 'a', winner: 'cloud' }]);
  });
});
