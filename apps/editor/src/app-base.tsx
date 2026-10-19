import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { useProjectStore } from './stores/useProjectStore';
import { useTheme } from './lib/theme';
import { Toaster } from 'sonner';
import AppLayout from './components/layouts/app-layout';
import ExampleLoader from './components/example-loader';
import HomePage from './pages/home/home-page';
import ProductAnalyticsTracker from './components/analytics/product-analytics-tracker';
import WhatsNewNotice from './components/whats-new-notice';

// Home is the landing page and loads with the app; every other page, the
// editor and React Flow above all, loads when it's first visited
const EditorPage = lazy(() => import('./pages/editor/editor-page'));
const ProjectsPage = lazy(() => import('./pages/projects/projects-page'));
const SettingsPage = lazy(() => import('./pages/settings/settings-page'));
const AdminPage = lazy(() => import('./pages/admin/admin-page'));
const PricingPage = lazy(() => import('./pages/pricing/pricing-page'));
const PrivacyPage = lazy(() => import('./pages/privacy/privacy-page'));
const ChangelogPage = lazy(() => import('./pages/changelog/changelog-page'));

import './index.css';

function App() {
	const restoreLastProject = useProjectStore((state) => state.restoreLastProject);

	// Reopen the last project on startup, like the old editor's recents
	useEffect(() => {
		restoreLastProject();
	}, [restoreLastProject]);

	// Theme is applied before first paint by the inline script in index.html;
	// useTheme only keeps it in sync with OS and cross-tab changes.
	const { resolved } = useTheme();

	return (
		<BrowserRouter>
			<Toaster position="bottom-right" theme={resolved} />
			<ExampleLoader />
			<ProductAnalyticsTracker />
			<WhatsNewNotice />
			<AppLayout>
				<Suspense fallback={null}>
					<Routes>
						<Route path="/" element={<HomePage />} />
						<Route path="/editor" element={<EditorPage />} />
						<Route path="/projects" element={<ProjectsPage />} />
						<Route path="/settings" element={<SettingsPage />} />
						<Route path="/pricing" element={<PricingPage />} />
						<Route path="/privacy" element={<PrivacyPage />} />
						<Route path="/changelog" element={<ChangelogPage />} />
						<Route path="/admin" element={<AdminPage />} />
					</Routes>
				</Suspense>
			</AppLayout>
		</BrowserRouter>
	);
}

export default App;
