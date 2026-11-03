import { describe, expect, it } from 'vitest';

import { confirmDialog, promptDialog, settle, useDialogStore } from './dialogs';

describe('dialogs', () => {
  it('resolves a confirm with the choice and closes', async () => {
    const yes = confirmDialog({ title: 'Delete?' });
    expect(useDialogStore.getState()).toMatchObject({ open: true, request: { kind: 'confirm', title: 'Delete?' } });
    settle(true);
    await expect(yes).resolves.toBe(true);
    expect(useDialogStore.getState().open).toBe(false);

    const no = confirmDialog({ title: 'Delete?' });
    settle(null);
    await expect(no).resolves.toBe(false);
  });

  it('resolves a prompt with the value, or null when cancelled', async () => {
    const named = promptDialog({ title: 'New tree' });
    settle('Patrol');
    await expect(named).resolves.toBe('Patrol');

    const cancelled = promptDialog({ title: 'New tree' });
    settle(null);
    await expect(cancelled).resolves.toBeNull();
  });

  it('cancels an open dialog when another one opens', async () => {
    const first = promptDialog({ title: 'First' });
    const second = confirmDialog({ title: 'Second' });
    await expect(first).resolves.toBeNull();
    expect(useDialogStore.getState().request?.title).toBe('Second');
    settle(true);
    await expect(second).resolves.toBe(true);
  });

  it('ignores settling once closed', async () => {
    const pending = confirmDialog({ title: 'Once' });
    settle(true);
    settle(false);
    await expect(pending).resolves.toBe(true);
  });
});
