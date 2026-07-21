import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

import App from './app-base.tsx';
import { initAnalytics } from './lib/analytics';

initAnalytics();

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
