import posthog from 'posthog-js';

// Public project API key — safe to commit (PostHog keys are write-only).
const POSTHOG_KEY = 'phc_zJzYsJvv7qpNZgQxCqVP2ksqB2YNd7eBvFD9YtjvDZ2Q';
const PROD_HOSTS = ['www.behaviortrees.com', 'behaviortrees.com'];

export type ProjectOrigin =
  | 'new'
  | 'import'
  | 'example'
  | 'guide_example'
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
  home_preview_clicked: { example: string };
  home_cta_clicked: { cta: 'create_project' | 'continue_project' | 'guides' };
  tree_created: Record<string, never>;
  project_created: Record<string, never>;
  project_saved: Record<string, unknown>;
  import: { type: string; source: 'paste' | 'file' | 'example' };
  export: {
    type: 'project' | 'tree' | 'nodes';
    format: 'json' | 'compact';
    method: 'copy' | 'download';
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
      capture_pageleave: false,
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

export function identifyUser(id: string, props?: Record<string, unknown>): void {
  if (!enabled) return;
  try {
    posthog.identify(id, props);
    posthog.register({ signed_in: true });
  } catch {
    // no-op
  }
}

export function resetUser(): void {
  if (!enabled) return;
  try {
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
