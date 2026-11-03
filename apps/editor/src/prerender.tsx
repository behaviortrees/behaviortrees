import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import HomePage from './pages/home/home-page';
import { PricingContent } from './pages/pricing/pricing-page';
import ChangelogPage from './pages/changelog/changelog-page';
import PrivacyPage from './pages/privacy/privacy-page';
import TermsPage from './pages/terms/terms-page';

// Build-time HTML for the public pages, so crawlers and AI agents that don't
// run JavaScript get the content instead of an empty #root. Browsers that do
// run it hide this markup (see index.html) and React renders the real page.

export type PrerenderRoute = {
	path: string;
	file: string;
	title: string;
	description: string;
	jsonLd?: Record<string, unknown>;
	element: ReactNode;
};

export const ROUTES: PrerenderRoute[] = [
	{
		path: '/',
		file: 'index.html',
		title: 'Behavior Tree Editor - Free Online Visual Editor for Game AI',
		description:
			'Design behavior trees for game AI and robotics in a free online visual editor. Create sequences, selectors, decorators and custom nodes, then export to JSON. No signup required.',
		jsonLd: {
			'@context': 'https://schema.org',
			'@type': 'WebApplication',
			name: 'Behavior Tree Editor',
			url: 'https://www.behaviortrees.com/',
			description:
				'A free, open source online visual editor for behavior trees used in game AI and robotics. Imports and exports behavior3 JSON and BehaviorTree.CPP XML (Groot2, ROS 2 Nav2).',
			applicationCategory: 'DeveloperApplication',
			operatingSystem: 'Any (web browser)',
			browserRequirements: 'Requires JavaScript',
			isAccessibleForFree: true,
			license: 'https://www.gnu.org/licenses/agpl-3.0.html',
			offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
			sameAs: ['https://github.com/behaviortrees/behaviortrees'],
		},
		element: <HomePage />,
	},
	{
		path: '/pricing',
		file: 'pricing.html',
		title: 'Pricing - Behavior Tree Editor',
		description:
			'The behaviortrees.com editor is free and open source. Custom integrations with Unity, BehaviorTree.CPP / ROS 2 and proprietary runtimes start at $2,500.',
		element: <PricingContent />,
	},
	{
		path: '/changelog',
		file: 'changelog.html',
		title: "What's New - Behavior Tree Editor",
		description: 'Recent changes to the behaviortrees.com behavior tree editor.',
		element: <ChangelogPage />,
	},
	{
		path: '/privacy',
		file: 'privacy.html',
		title: 'Privacy Notice - Behavior Tree Editor',
		description: 'How behaviortrees.com handles projects, analytics and account data.',
		element: <PrivacyPage />,
	},
	{
		path: '/terms',
		file: 'terms.html',
		title: 'Terms of Service - Behavior Tree Editor',
		description: 'Terms for using behaviortrees.com, its MCP server and the behaviortrees command-line tool.',
		element: <TermsPage />,
	},
];

const NAV = [
	{ href: '/', label: 'Home' },
	{ href: '/editor', label: 'Editor' },
	{ href: '/learn/', label: 'Guides' },
	{ href: '/pricing', label: 'Pricing' },
	{ href: '/changelog', label: 'Changelog' },
	{ href: '/llms.txt', label: 'llms.txt' },
];

export const renderRoute = (route: PrerenderRoute): string =>
	renderToString(
		<MemoryRouter initialEntries={[route.path]}>
			<div data-prerender="">
				<header>
					<nav aria-label="Main">
						<ul>
							{NAV.map((link) => (
								<li key={link.href}>
									<a href={link.href}>{link.label}</a>
								</li>
							))}
						</ul>
					</nav>
				</header>
				<main>{route.element}</main>
				<footer>
					<p>
						Open source on{' '}
						<a href="https://github.com/behaviortrees/behaviortrees">GitHub</a>.
					</p>
				</footer>
			</div>
		</MemoryRouter>
	);
