import React, { ReactNode } from 'react';
import { MessageSquare } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import AuthControls from '../auth/auth-controls';
import AdminNavLink from '../auth/admin-nav-link';
import { isAnalyticsEnabled } from '../../lib/analytics';
import { CLOUD_ENABLED } from '../../lib/auth';

type AppLayoutProps = {
	children: ReactNode;
};

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
	isActive ? 'text-accent-soft' : 'text-muted transition-colors hover:text-accent-soft';

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
	// The editor is a full-bleed application screen: no page gutter, no footer,
	// and it owns the viewport below the header.
	const isEditor = useLocation().pathname === '/editor';

	return (
		<div
			className={
				isEditor
					? 'flex h-screen flex-col overflow-hidden bg-base text-fg'
					: 'flex min-h-screen flex-col bg-base text-fg'
			}
		>
			<header className="flex h-[54px] flex-none items-center gap-8 border-b border-divider px-6">
				<Link to="/" className="flex items-center gap-3">
					<img src="/imgs/logo.svg" alt="" className="h-[22px] w-[22px] rounded-[5px]" />
					<span className="text-[15px] font-medium tracking-[-0.01em]">
						behavior<span className="text-accent">trees</span>
					</span>
				</Link>

				<nav>
					<ul className="flex items-center gap-6 text-[13px]">
						<li>
							<NavLink to="/" className={navLinkClass}>
								Home
							</NavLink>
						</li>
						<li>
							<NavLink to="/editor" className={navLinkClass}>
								Editor
							</NavLink>
						</li>
						<li>
							<NavLink to="/projects" className={navLinkClass}>
								Projects
							</NavLink>
						</li>
						<li>
							<NavLink to="/settings" className={navLinkClass}>
								Settings
							</NavLink>
						</li>
						<li>
							{/* Static guides site deployed alongside the app */}
							<a href="/learn/" className="text-muted transition-colors hover:text-accent-soft">
								Learn
							</a>
						</li>
						{CLOUD_ENABLED && <AdminNavLink />}
					</ul>
				</nav>

				<div className="ml-auto flex items-center gap-5">
					{isAnalyticsEnabled() && (
						// The PostHog survey attaches to this class and opens on click
						<button
							type="button"
							className="bt-feedback-button flex cursor-pointer items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-accent-soft"
						>
							<MessageSquare className="h-3.5 w-3.5" />
							Feedback
						</button>
					)}
					{CLOUD_ENABLED && <AuthControls />}
				</div>
			</header>

			{isEditor ? (
				<main className="flex min-h-0 flex-1 flex-col">{children}</main>
			) : (
				<>
					<main className="container mx-auto flex-1 px-6 py-10">{children}</main>
					<footer className="border-t border-divider">
						<div className="container mx-auto px-6 py-5 text-center text-[13px] text-muted">
							&copy; {new Date().getFullYear()} behaviortrees.com ·{' '}
							<a href="/learn/" className="text-accent-soft hover:underline">
								Learn behavior trees
							</a>{' '}
							· Prefer the classic editor? It lives on at{' '}
							<a href="https://old.behaviortrees.com" className="text-accent-soft hover:underline">
								old.behaviortrees.com
							</a>
							.
						</div>
					</footer>
				</>
			)}
		</div>
	);
};

export default AppLayout;
