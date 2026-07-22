import posthog from 'posthog-js';

// Public project API key — safe to commit (PostHog keys are write-only).
const POSTHOG_KEY = 'phc_zJzYsJvv7qpNZgQxCqVP2ksqB2YNd7eBvFD9YtjvDZ2Q';
const PROD_HOSTS = ['www.behaviortrees.com', 'behaviortrees.com'];

function debugEnabled(): boolean {
  try {
    return localStorage.getItem('bt-analytics-debug') === '1';
  } catch {
    return false;
  }
}

let enabled = false;

export function initAnalytics(): void {
  const debug = debugEnabled();
  if (!PROD_HOSTS.includes(window.location.hostname) && !debug) return;
  if (POSTHOG_KEY.includes('REPLACE')) return;
  try {
    posthog.init(POSTHOG_KEY, {
      // No local proxy in debug mode, so hit PostHog directly
      api_host: debug ? 'https://us.i.posthog.com' : '/ingest',
      ui_host: 'https://us.posthog.com',
      defaults: '2025-05-24',
      persistence: 'memory',
      autocapture: false,
      capture_pageview: 'history_change',
      capture_pageleave: false,
      disable_session_recording: true,
      disable_surveys: true,
    });
    posthog.register({ editor: 'react' });
    if (debug) posthog.debug(true);
    enabled = true;
  } catch {
    // Analytics must never break the app
  }
}

export function track(event: string, props?: Record<string, unknown>): void {
  if (!enabled) return;
  try {
    posthog.capture(event, props);
  } catch {
    // no-op
  }
}
