import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import './index.css';

import App from './app-base.tsx';
import CloudSyncController from './components/auth/cloud-sync-controller.tsx';
import { initAnalytics } from './lib/analytics';
import { CLERK_PUBLISHABLE_KEY, CLOUD_ENABLED } from './lib/auth';
import { initWhatsNew } from './lib/changelog';

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
