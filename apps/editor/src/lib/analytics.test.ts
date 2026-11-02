// @vitest-environment jsdom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const posthog = vi.hoisted(() => ({
  init: vi.fn(),
  register: vi.fn(),
  debug: vi.fn(),
  capture: vi.fn(),
  reset: vi.fn(),
  get_property: vi.fn(),
}));

vi.mock('posthog-js', () => ({ default: posthog }));

import { initAnalytics, resetUser } from './analytics';

describe('resetUser', () => {
  beforeAll(() => {
    localStorage.setItem('bt-analytics-debug', '1');
    initAnalytics();
  });

  beforeEach(() => vi.clearAllMocks());

  it('keeps an anonymous visitor on the same person', () => {
    posthog.get_property.mockReturnValue('anonymous');
    resetUser();
    expect(posthog.reset).not.toHaveBeenCalled();
  });

  it('resets a signed-in person who signed out', () => {
    posthog.get_property.mockReturnValue('identified');
    resetUser();
    expect(posthog.reset).toHaveBeenCalledOnce();
    expect(posthog.register).toHaveBeenCalledWith({ editor: 'react', signed_in: false });
  });
});
