import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import './index.css';

import App from './app-base.tsx';
import CloudSyncController from './components/auth/cloud-sync-controller.tsx';
import { initAnalytics } from './lib/analytics';
import { CLERK_PUBLISHABLE_KEY, CLOUD_ENABLED } from './lib/auth';

initAnalytics();

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
