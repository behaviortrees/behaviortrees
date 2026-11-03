import { describe, expect, it } from 'vitest';
import { isAcceptableTimestamp, MAX_FUTURE_MS, validateProjectPayload } from './validate.js';

const project = {
  id: 'p1',
  name: 'Project',
  scope: 'project',
  trees: [],
  updatedAt: new Date().toISOString(),
};

describe('project payload validation', () => {
  it('accepts a current timestamp', () => {
    expect(validateProjectPayload(project).ok).toBe(true);
  });

  it('rejects a timestamp far in the future', () => {
    const updatedAt = new Date(Date.now() + MAX_FUTURE_MS + 60_000).toISOString();
    const result = validateProjectPayload({ ...project, updatedAt });
    expect(result).toEqual({
      ok: false,
      error: 'Not a behavior3 project: updatedAt is in the future',
    });
  });

  it('allows ordinary clock skew', () => {
    const updatedAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(validateProjectPayload({ ...project, updatedAt }).ok).toBe(true);
  });
});

describe('isAcceptableTimestamp', () => {
  it('rejects non-strings, garbage and far-future dates', () => {
    expect(isAcceptableTimestamp(undefined)).toBe(false);
    expect(isAcceptableTimestamp('yesterday')).toBe(false);
    expect(isAcceptableTimestamp(new Date(Date.now() + 2 * MAX_FUTURE_MS).toISOString())).toBe(false);
    expect(isAcceptableTimestamp('2020-01-01T00:00:00.000Z')).toBe(true);
  });
});
