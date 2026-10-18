import React from 'react';
import { Link } from 'react-router-dom';
import { TreePreview } from '../../components/home/tree-preview';
import { track } from '../../lib/analytics';
import { CLOUD_ENABLED } from '../../lib/auth';
import { LATEST_RELEASE } from '../../lib/changelog';
import { useProjectStore } from '../../stores/useProjectStore';

// Why this editor, not what it does: the live preview above already shows that
const REASONS = [
	{
		title: 'Free, no account',
		body: CLOUD_ENABLED
			? 'Everything saves in your browser. Sign in only if you want projects synced across machines.'
			: 'Everything saves in your browser. Nothing to sign up for.',
	},
	{
		title: 'behavior3 format',
		body: 'Exports plain JSON that behavior3 runtimes read, with your custom nodes included.',
	},
	{
		title: 'Learn as you go',
		body: 'Guides explain each concept, with example trees you can open in one click.',
	},
];

const HomePage: React.FC = () => {
	const project = useProjectStore((state) => state.project);

	// Nocturne is flush-left and asymmetric: content hugs the left edge and the
	// whitespace is allowed to fall on the right.
	return (
		<div className="max-w-4xl">
			<div className="mb-12 max-w-2xl">
				<Link
					to="/changelog"
					onClick={() => track('whats_new_clicked', { release: LATEST_RELEASE.id, placement: 'home' })}
					className="mb-6 inline-flex max-w-full items-center gap-2 rounded-full border border-border px-3 py-1 text-[13px] text-muted transition-colors hover:border-accent hover:text-fg"
				>
					<span className="shrink-0 rounded-full bg-accent-wash px-2 py-px text-xs font-medium text-accent-soft">
						New
					</span>
					<span className="truncate">{LATEST_RELEASE.title}</span>
					<span aria-hidden="true" className="shrink-0 text-accent-soft">→</span>
				</Link>
				<div className="kicker mb-3 text-accent-soft">Behavior trees</div>
				<h1 className="mb-4 text-4xl font-medium tracking-[-0.02em] text-fg">
					Behavior Tree Editor
				</h1>
				<p className="text-xl text-muted text-pretty">
					A free online editor for creating behavior trees for games, AI, and robotics.
				</p>

				<div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
					<Link
						to="/editor"
						onClick={() => track('home_cta_clicked', { cta: project ? 'continue_project' : 'create_project' })}
						className="inline-flex min-w-0 items-center justify-center rounded-md border border-accent bg-transparent px-4 py-2 text-accent-soft transition hover:bg-accent/15"
					>
						<span className="truncate">{project ? `Continue “${project.name}”` : 'Create Project'}</span>
					</Link>
					<a
						href="/learn/"
						onClick={() => track('home_cta_clicked', { cta: 'guides' })}
						className="inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-transparent px-4 py-2 text-fg transition hover:bg-fg/7"
					>
						Read the guides
					</a>
				</div>

				<p className="mt-5 text-sm text-faint text-pretty">
					Or open an example:{' '}
					<a href="/?example=enemy-patrol" className="text-accent-soft hover:underline">enemy patrol AI</a>,{' '}
					<a href="/?example=open-the-door" className="text-accent-soft hover:underline">selector vs sequence</a>,{' '}
					<a href="/?example=robot-pick-and-place" className="text-accent-soft hover:underline">robot pick &amp; place</a>.
					Prefer the classic editor?{' '}
					<a href="https://old.behaviortrees.com" className="text-accent-soft hover:underline">old.behaviortrees.com</a>
				</p>
			</div>

			<TreePreview />

			<div className="grid gap-8 sm:grid-cols-3">
				{REASONS.map((reason) => (
					<div key={reason.title}>
						<h2 className="mb-2 text-base font-medium text-fg">{reason.title}</h2>
						<p className="text-sm text-muted text-pretty">{reason.body}</p>
					</div>
				))}
			</div>
		</div>
	);
};

export default HomePage;
