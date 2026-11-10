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

import { dropNoiseExceptions, initAnalytics, resetUser } from './analytics';

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

describe('dropNoiseExceptions', () => {
  const exception = (value: string) =>
    ({
      event: '$exception',
      properties: { $exception_list: [{ type: 'Error', value }] },
    }) as unknown as Parameters<typeof dropNoiseExceptions>[0];

  it('drops a blocked clerk-js load', () => {
    const event = exception(
      'Clerk: Failed to load Clerk, failed to load script: https://clerk.behaviortrees.com/npm/@clerk/clerk-js@5/dist/clerk.browser.js\n\n(code="failed_to_load_clerk_js")'
    );
    expect(dropNoiseExceptions(event)).toBeNull();
  });

  it("drops Microsoft's link scanner rejections", () => {
    const event = exception(
      'Non-Error promise rejection captured with value: Object Not Found Matching Id:2, MethodName:update, ParamCount:4'
    );
    expect(dropNoiseExceptions(event)).toBeNull();
  });

  it('keeps real errors', () => {
    const event = exception("Cannot read properties of undefined (reading 'id')");
    expect(dropNoiseExceptions(event)).toBe(event);
  });
});
