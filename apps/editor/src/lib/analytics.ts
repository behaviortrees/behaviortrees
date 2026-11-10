import posthog, { type CaptureResult } from 'posthog-js';

// Public project API key — safe to commit (PostHog keys are write-only).
const POSTHOG_KEY = 'phc_zJzYsJvv7qpNZgQxCqVP2ksqB2YNd7eBvFD9YtjvDZ2Q';
const PROD_HOSTS = ['www.behaviortrees.com', 'behaviortrees.com'];

export type ProjectOrigin =
  | 'new'
  | 'import'
  | 'example'
  | 'guide_example'
  | 'shared_link'
  | 'restored'
  | 'unknown';

export type CommercialPlan = 'pro' | 'team' | 'integration';

export type RuntimeSegment =
  | 'unity'
  | 'unreal'
  | 'godot'
  | 'behaviortree_cpp_ros2'
  | 'custom_engine'
  | 'javascript_web'
  | 'evaluating'
  | 'other';

export type ImportFailureReason =
  | 'invalid_json'
  | 'invalid_xml'
  | 'xml_doctype'
  | 'not_behavior_tree'
  | 'no_open_project'
  | 'nodes_file_needs_editor'
  | 'unexpected';

export type UsageMode = 'solo' | 'team_2_5' | 'team_6_20' | 'team_21_plus';

export type ProductionObstacle =
  | 'runtime_integration'
  | 'testing_debugging'
  | 'collaboration_review'
  | 'version_control'
  | 'tree_validation'
  | 'runtime_portability'
  | 'learning'
  | 'other';

type ProjectMetrics = {
  project_id: string;
  node_count: number;
  connection_count: number;
  tree_count: number;
  custom_node_count: number;
  origin: ProjectOrigin;
};

export type AnalyticsEventMap = {
  app_session_started: { path: string };
  editor_session_started: { has_project: boolean; project_origin: ProjectOrigin };
  user_signed_in: { had_local_projects: boolean };
  cloud_sync_started: { local_project_count: number };
  cloud_sync_succeeded: {
    initial_sync: boolean;
    pull_count: number;
    push_count: number;
    conflict_count: number;
  };
  cloud_sync_failed: { failure_category: 'offline' | 'api' | 'unknown' };
  auth_unavailable: Record<string, never>;
  project_became_substantial: ProjectMetrics;
  activation_completed: ProjectMetrics & { trigger: 'save' | 'export' };
  pricing_viewed: { activated_before_view: boolean };
  pricing_cta_clicked: { plan: CommercialPlan; placement: 'pricing_card' };
  commercial_interest_submitted: {
    plan: CommercialPlan;
    runtime: RuntimeSegment;
    usage_mode: UsageMode;
    obstacle: ProductionObstacle;
  };
  commercial_interest_failed: {
    plan: CommercialPlan;
    failure_category: 'validation' | 'network' | 'server' | 'unknown';
  };
  example_loaded: { example: string };
  shared_link_opened: { kind: 'tree' | 'project'; encoding: 'json' | 'deflate' };
  shared_link_failed: Record<string, never>;
  home_preview_clicked: { example: string };
  home_cta_clicked: { cta: 'create_project' | 'continue_project' | 'guides' };
  tree_created: Record<string, never>;
  project_created: Record<string, never>;
  project_saved: Record<string, unknown>;
  import: { type: string; source: 'paste' | 'file' | 'example'; format: 'b3' | 'btcpp' };
  import_failed: {
    source: 'paste' | 'file' | 'example';
    format: 'b3' | 'btcpp';
    reason: ImportFailureReason;
    // The parser's message for invalid_xml, e.g. "1:27: unclosed tag: Sequence"
    detail?: string;
  };
  export: {
    type: 'project' | 'tree' | 'nodes';
    format: 'json' | 'compact' | 'btcpp_v4' | 'btcpp_v3';
    method: 'copy' | 'download' | 'link';
  };
  custom_node_created: { category: string };
  whats_new_shown: { release: string };
  whats_new_clicked: { release: string; placement: 'notice' | 'home' };
  whats_new_dismissed: { release: string };
};

function debugEnabled(): boolean {
  try {
    return localStorage.getItem('bt-analytics-debug') === '1';
  } catch {
    return false;
  }
}

let enabled = false;
// Set once main.tsx starts reloading for a new deploy (see vite:preloadError)
let reloadingForNewDeploy = false;

// A tree opened from a link rides in the URL fragment (lib/share-link.ts).
// It's cleared before analytics starts, but a link pasted into an open tab
// can reach a pageview first; tree contents never belong in events.
function dropSharedTrees(event: CaptureResult | null): CaptureResult | null {
  const url = event?.properties?.$current_url;
  if (typeof url === 'string' && url.includes('#tree=')) {
    event!.properties.$current_url = url.slice(0, url.indexOf('#tree='));
  }
  return event;
}

// Exceptions that are never bugs, kept out of error tracking
export function dropNoiseExceptions(event: CaptureResult | null): CaptureResult | null {
  if (event?.event !== '$exception') return event;
  // Cancelling vite:preloadError makes the stale chunk's import() resolve to
  // undefined, so React.lazy throws "reading 'default'" just before the reload
  // lands. Nothing thrown while the page is being replaced is real.
  if (reloadingForNewDeploy) return null;
  const list = event.properties?.$exception_list as { value?: string }[] | undefined;
  const matches = (test: (value: string) => boolean) =>
    list?.some((e) => typeof e.value === 'string' && test(e.value)) ?? false;
  // The browser deferring resize notifications a frame (React Flow triggers
  // it). Harmless, and reported without a stack.
  if (matches((v) => v.startsWith('ResizeObserver loop'))) return null;
  // An ad blocker or network blocking clerk-js. Clerk's loader rethrows it as
  // an unhandled rejection we can't catch; the header shows sign-in as
  // unavailable and tracks auth_unavailable instead.
  if (matches((v) => v.includes('failed_to_load_clerk_js'))) return null;
  // Microsoft's link scanner (Outlook Safe Links) driving the page.
  if (matches((v) => v.includes('Object Not Found Matching Id:'))) return null;
  return event;
}

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
      // A durable first-party id is required for anonymous D7/D30 retention.
      persistence: 'localStorage',
      autocapture: false,
      capture_pageview: 'history_change',
      // $pageleave gives web analytics session duration and bounce rate
      capture_pageleave: true,
      // Error tracking: window errors and unhandled rejections. React 19
      // reports uncaught render errors through window.reportError, so those
      // land here too. Stack traces resolve via the source maps vite.config.ts
      // uploads on production builds.
      capture_exceptions: true,
      before_send: [dropSharedTrees, dropNoiseExceptions],
      disable_surveys: false,
      session_recording: {
        maskAllInputs: true,
      },
    });
    posthog.register({ editor: 'react', signed_in: false });
    if (debug) posthog.debug(true);
    enabled = true;
    track('app_session_started', { path: window.location.pathname });
  } catch {
    // Analytics must never break the app
  }
}

export function markReloadingForNewDeploy(): void {
  reloadingForNewDeploy = true;
}

export function isAnalyticsEnabled(): boolean {
  return enabled;
}

export function track<Event extends keyof AnalyticsEventMap>(
  event: Event,
  props?: AnalyticsEventMap[Event]
): void {
  if (!enabled) return;
  try {
    posthog.capture(event, props);
  } catch {
    // no-op
  }
}

// For errors the app catches but that still mean a bug; uncaught ones are
// captured automatically.
export function captureError(error: unknown, props?: Record<string, unknown>): void {
  if (!enabled) return;
  try {
    posthog.captureException(error, props);
  } catch {
    // no-op
  }
}

export function identifyUser(id: string, props?: Record<string, unknown>): void {
  if (!enabled) return;
  try {
    posthog.identify(id, props);
    posthog.register({ signed_in: true });
  } catch {
    // no-op
  }
}

// Only a signed-in person is reset. Resetting an anonymous visitor (every
// load where Clerk finds no session) mints a new person per visit, which
// splits users and breaks retention.
export function resetUser(): void {
  if (!enabled) return;
  try {
    if (posthog.get_property('$user_state') !== 'identified') return;
    posthog.reset();
    posthog.register({ editor: 'react', signed_in: false });
  } catch {
    // no-op
  }
}

export function registerAnalyticsProperties(props: Record<string, unknown>): void {
  if (!enabled) return;
  try {
    posthog.register(props);
  } catch {
    // no-op
  }
}
