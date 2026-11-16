import { describe, expect, it } from 'vitest';
import { parseInterestStatusUpdate, validateCommercialInterest } from './interest-validate.js';

const valid = {
  email: 'Developer@example.com',
  plan: 'team',
  runtime: 'unity',
  usageMode: 'team_2_5',
  obstacle: 'collaboration_review',
  obstacleDetail: 'We review exported trees in pull requests.',
  sourcePath: '/pricing',
  contactConsent: true,
  website: '',
};

describe('commercial interest validation', () => {
  it('accepts a complete request', () => {
    const result = validateCommercialInterest(valid);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.interest.plan).toBe('team');
  });

  it('rejects invalid emails and missing consent', () => {
    expect(validateCommercialInterest({ ...valid, email: 'not-email' }).ok).toBe(false);
    const noConsent = validateCommercialInterest({ ...valid, contactConsent: false });
    expect(noConsent).toEqual({
      ok: false,
      error: 'Confirm that we may contact you about this request',
    });
  });

  it('limits free-form details', () => {
    expect(
      validateCommercialInterest({
        ...valid,
        obstacleDetail: 'x'.repeat(1001),
      }).ok
    ).toBe(false);
  });
});

describe('interest status updates', () => {
  it('accepts each status for a request id', () => {
    for (const status of ['new', 'reviewed', 'replied']) {
      expect(parseInterestStatusUpdate({ id: 7, status })).toEqual({ id: 7, status });
    }
  });

  it('rejects unknown statuses, bad ids and missing bodies', () => {
    expect(parseInterestStatusUpdate({ id: 7, status: 'archived' })).toBeNull();
    expect(parseInterestStatusUpdate({ id: '7', status: 'reviewed' })).toBeNull();
    expect(parseInterestStatusUpdate({ id: 0, status: 'reviewed' })).toBeNull();
    expect(parseInterestStatusUpdate({ id: 1.5, status: 'reviewed' })).toBeNull();
    expect(parseInterestStatusUpdate(undefined)).toBeNull();
  });
});
