import { listLocalProjects } from './storage/local-projects';

export type ChangeKind = 'new' | 'improved' | 'fixed';

export type ChangelogEntry = {
  // Stable id, also stored as the "last seen" marker; use the release date
  id: string;
  date: string;
  title: string;
  summary: string;
  changes: { kind: ChangeKind; text: string }[];
};

// Newest first. The first entry drives the home page pill and the
// one-time "what's new" notice for returning users.
export const CHANGELOG: ChangelogEntry[] = [
  {
    id: '2026-10-18',
    date: '2026-10-18',
    title: 'Move whole branches and see run order',
    summary:
      'Two things you asked for: moving groups of nodes together, and a clear view of the order children run in.',
    changes: [
      {
        kind: 'new',
        text: 'Alt+drag (Option+drag on Mac) a node to move it together with everything below it. Or right-click a node and choose Select branch, then drag.',
      },
      {
        kind: 'new',
        text: 'Numbers on the connections show the order each child runs in. Children run top to bottom (left to right in vertical layout), and the numbers update live as you drag.',
      },
      {
        kind: 'improved',
        text: 'Auto organize keeps the order you see on screen, including when you switch between horizontal and vertical layout.',
      },
      {
        kind: 'improved',
        text: 'The Projects page has an Open in editor button, and a Go to editor button on the project you have open.',
      },
      {
        kind: 'fixed',
        text: 'Moved nodes, including box selections, now keep their position after you save and reload. Each move is a single undo step.',
      },
      {
        kind: 'fixed',
        text: 'Exports in vertical layout now list children left to right, matching the canvas and the classic editor.',
      },
      {
        kind: 'fixed',
        text: 'Undo right after reloading the page no longer clears the canvas.',
      },
    ],
  },
];

export const LATEST_RELEASE = CHANGELOG[0];

const SEEN_KEY = 'bt-whats-new-seen';

// Decided once at startup, before anything (like an example link) creates
// a project: only people who already had projects are "returning".
let showOnBoot: boolean | null = null;

function decideOnBoot(): boolean {
  try {
    const seen = localStorage.getItem(SEEN_KEY);
    if (seen === LATEST_RELEASE.id) return false;
    if (listLocalProjects().length === 0) {
      // First visit: everything is new, so start them as caught up
      localStorage.setItem(SEEN_KEY, LATEST_RELEASE.id);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function initWhatsNew(): void {
  if (showOnBoot === null) showOnBoot = decideOnBoot();
}

export function shouldShowWhatsNew(): boolean {
  return showOnBoot === true;
}

export function markWhatsNewSeen(): void {
  showOnBoot = false;
  try {
    localStorage.setItem(SEEN_KEY, LATEST_RELEASE.id);
  } catch {
    // Storage blocked: the notice may show again, which is harmless
  }
}
