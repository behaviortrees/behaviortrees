import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import './index.css';

import App from './app-base.tsx';
import CloudSyncController from './components/auth/cloud-sync-controller.tsx';
import { initAnalytics, markReloadingForNewDeploy } from './lib/analytics';
import { CLERK_PUBLISHABLE_KEY, CLOUD_ENABLED } from './lib/auth';
import { initWhatsNew } from './lib/changelog';

// A tab opened before a deploy asks for page chunks the new deploy no longer
// has. Reload once to pick up the new build; if that already happened in the
// last minute, let the error surface rather than loop.
window.addEventListener('vite:preloadError', (event) => {
	const key = 'bt-chunk-reload';
	try {
		if (Date.now() - Number(sessionStorage.getItem(key) ?? 0) < 60_000) return;
		sessionStorage.setItem(key, String(Date.now()));
	} catch {
		return;
	}
	event.preventDefault();
	markReloadingForNewDeploy();
	window.location.reload();
});

initAnalytics();
// Before render, so a project created by this visit doesn't count as returning
initWhatsNew();

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		{CLOUD_ENABLED ? (
			<ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY!} afterSignOutUrl="/">
				<CloudSyncController />
				<App />
			</ClerkProvider>
		) : (
			<App />
		)}
	</StrictMode>,
);
