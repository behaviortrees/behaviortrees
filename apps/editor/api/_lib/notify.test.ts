import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ValidatedCommercialInterest } from './interest-validate.js';
import { formatInterestEmail, notifyCommercialInterest } from './notify.js';

const interest: ValidatedCommercialInterest = {
  email: ' Dev@Example.com ',
  plan: 'integration',
  runtime: 'evaluating',
  usageMode: 'team_2_5',
  obstacle: 'runtime_integration',
  obstacleDetail: 'we want to integrate into unreal',
  sourcePath: '/pricing',
  contactConsent: true,
};

describe('interest notification', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('formats the full request as plain text', () => {
    const { subject, text } = formatInterestEmail(interest, true);
    expect(subject).toBe('New early-access request: dev@example.com (integration)');
    expect(text).toContain('Runtime:  evaluating');
    expect(text).toContain('we want to integrate into unreal');
  });

  it('labels repeat submissions as updates', () => {
    expect(formatInterestEmail(interest, false).subject).toMatch(/^Updated/);
  });

  it('does nothing when not configured', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await notifyCommercialInterest(interest, true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends to Resend with the requester as reply-to', async () => {
    vi.stubEnv('RESEND_API_KEY', 'key');
    vi.stubEnv('INTEREST_NOTIFY_EMAIL', 'me@example.com');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await notifyCommercialInterest(interest, true);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.to).toEqual(['me@example.com']);
    expect(body.reply_to).toBe('Dev@Example.com');
  });

  it('swallows send failures', async () => {
    vi.stubEnv('RESEND_API_KEY', 'key');
    vi.stubEnv('INTEREST_NOTIFY_EMAIL', 'me@example.com');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(notifyCommercialInterest(interest, true)).resolves.toBeUndefined();
  });
});
