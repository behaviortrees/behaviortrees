/**
 * analytics.js - PostHog product analytics (cookieless).
 *
 * Concatenated into preload.min.js by gulp, so it runs before the app.
 * This file must stay strict ES5: the gulp 3 uglify step cannot parse ES6.
 *
 * Exposes window.btAnalytics.track(event, props), which is always safe to
 * call: it no-ops off-production, when the key is unset, or when PostHog is
 * blocked. Enable locally with localStorage['bt-analytics-debug'] = '1'.
 */
(function() {
  /* eslint-disable */
  // Official PostHog ES5 snippet. With api_host '/ingest' it loads
  // /ingest/static/array.js, which the Netlify proxy serves first-party.
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey canRenderSurveyAsync identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageViewId captureTraceFeedback captureTraceMetric".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

  // Public project API key - same PostHog project as the React editor
  var POSTHOG_KEY = 'phc_zJzYsJvv7qpNZgQxCqVP2ksqB2YNd7eBvFD9YtjvDZ2Q';
  var PROD_HOSTS = ['behaviortrees.com', 'www.behaviortrees.com'];

  var debug = false;
  try {
    debug = window.localStorage.getItem('bt-analytics-debug') === '1';
  } catch (e) {}

  var enabled = false;
  var onProd = false;
  for (var i = 0; i < PROD_HOSTS.length; i++) {
    if (PROD_HOSTS[i] === window.location.hostname) { onProd = true; }
  }

  if ((onProd || debug) && POSTHOG_KEY.indexOf('REPLACE') === -1) {
    try {
      window.posthog.init(POSTHOG_KEY, {
        // No local proxy in debug mode, so hit PostHog directly
        api_host: debug ? 'https://us.i.posthog.com' : '/ingest',
        ui_host: 'https://us.posthog.com',
        defaults: '2025-05-24',
        persistence: 'memory',
        autocapture: false,
        capture_pageview: true,
        capture_pageleave: false,
        disable_session_recording: true,
        disable_surveys: true
      });
      window.posthog.register({ editor: 'classic' });
      if (debug) { window.posthog.debug(true); }
      enabled = true;
    } catch (e) {}
  }

  window.btAnalytics = {
    track: function(event, props) {
      if (!enabled) return;
      try {
        window.posthog.capture(event, props);
      } catch (e) {}
    }
  };
})();
