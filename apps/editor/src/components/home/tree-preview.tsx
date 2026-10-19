import enemyPatrol from '@behaviortrees/examples/trees/enemy-patrol.json';
import { Pause, Play } from 'lucide-react';
import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { track } from '../../lib/analytics';
import { B3Tree, b3ToTree } from '../../lib/behavior/b3';
import { DEFAULT_NODES } from '../../lib/behavior/defaults';
import { tickTree, TickEvent, TickStatus } from '../../lib/behavior/simulate';
import { NodeStatus, STATUS_COLOR, STATUS_LABEL } from './preview-status';

// A read-only, auto-playing run of the enemy patrol example for the home
// page. Each frame is one tick of the real tree against a scripted world;
// the traversal replays one node at a time so visitors can watch the
// selector fall through and the sequences short-circuit. The canvas (React
// Flow) loads after the page; the caption and controls render right away.

const TreePreviewCanvas = lazy(() => import('./tree-preview-canvas'));

const EXAMPLE = 'enemy-patrol';
const STEP_MS = 170;
const HOLD_MS = 1600;

// organize spaces leaves for the editor's taller nodes; the preview's
// nodes are compact, so pull rows closer to keep the zoom readable
const ROW_SCALE = 0.72;

type Frame = { caption: string; leaves: Record<string, TickStatus> };

// Keyed by node name; any leaf not listed fails
const FRAMES: Frame[] = [
	{
		caption: 'Nobody around: Attack and Chase fail their checks, so the Priority falls through to Patrol.',
		leaves: { MoveToWaypoint: 'running' },
	},
	{
		caption: 'Still walking. The whole tree runs again from the top on every tick.',
		leaves: { MoveToWaypoint: 'running' },
	},
	{
		caption: 'Waypoint reached. Wait is running, so Patrol keeps running too.',
		leaves: { MoveToWaypoint: 'success', Wait: 'running' },
	},
	{
		caption: 'Done waiting: Next Waypoint succeeds, so Patrol and the tree succeed.',
		leaves: { MoveToWaypoint: 'success', Wait: 'success', NextWaypoint: 'success' },
	},
	{
		caption: 'The player comes into view. Chase now passes its check and Patrol is never reached.',
		leaves: { IsPlayerVisible: 'success', MoveToPlayer: 'running' },
	},
	{
		caption: 'In range: the Attack branch wins and nothing below it is ticked.',
		leaves: { IsPlayerInRange: 'success', AttackPlayer: 'success' },
	},
];

const buildPreview = () => {
	const { tree } = b3ToTree(enemyPatrol as B3Tree, DEFAULT_NODES);
	Object.values(tree.blocks).forEach((block) => {
		block.position = { x: block.position.x, y: Math.round(block.position.y * ROW_SCALE) };
	});

	const isLeaf = (id: string) => ['action', 'condition'].includes(tree.blocks[id].category);
	const memory = new Map<string, number>();
	const ticks: TickEvent[][] = FRAMES.map((frame) =>
		tickTree(tree, (block) => frame.leaves[block.name] ?? 'failure', { memory })
			// A leaf shows its result straight away instead of an 'active' beat
			.filter((event) => event.type === 'exit' || !isLeaf(event.id))
	);

	return { tree, ticks, isLeaf };
};

const prefersReducedMotion = () => {
	try {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	} catch {
		return false;
	}
};

export const TreePreview: React.FC = () => {
	const { tree, ticks, isLeaf } = useMemo(buildPreview, []);
	const [reducedMotion] = useState(prefersReducedMotion);
	const [playing, setPlaying] = useState(!reducedMotion);
	const [frame, setFrame] = useState(0);
	// Reduced motion starts paused on a fully evaluated first tick
	const [step, setStep] = useState(() => (reducedMotion ? ticks[0].length : 0));

	const events = ticks[frame];
	const done = step >= events.length;

	useEffect(() => {
		if (!playing) return;
		const timer = window.setTimeout(
			() => {
				if (done) {
					setFrame((frame + 1) % ticks.length);
					setStep(0);
				} else {
					setStep(step + 1);
				}
			},
			done ? HOLD_MS : STEP_MS
		);
		return () => window.clearTimeout(timer);
	}, [playing, done, frame, step, ticks.length]);

	const statuses = useMemo(() => {
		const map: Record<string, NodeStatus> = {};
		events.slice(0, step).forEach((event) => {
			map[event.id] = event.type === 'enter' ? 'active' : event.status;
		});
		return map;
	}, [events, step]);

	// The most recent leaf result, for the canvas to follow on small screens;
	// once the tick is done, the whole tree is shown with its result
	const focusId = done
		? undefined
		: events
				.slice(0, step)
				.reverse()
				.find((event) => isLeaf(event.id))?.id;

	const result = done ? statuses[tree.rootId!] : undefined;

	return (
		<figure className="card mb-12 !p-0 overflow-hidden">
			<div className="h-[260px] sm:h-[400px] border-b border-border" aria-hidden="true">
				<Suspense fallback={null}>
					<TreePreviewCanvas tree={tree} statuses={statuses} focusId={focusId} animate={!reducedMotion} />
				</Suspense>
			</div>

			<figcaption className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
				<div className="min-w-0">
					<div className="kicker mb-1.5 flex items-center gap-2">
						Tick {frame + 1}
						{result && result !== 'active' && (
							<span style={{ color: STATUS_COLOR[result] }}>→ {STATUS_LABEL[result]}</span>
						)}
					</div>
					<p className="text-sm text-muted text-pretty">{FRAMES[frame].caption}</p>
				</div>

				<div className="flex shrink-0 items-center gap-2">
					<button
						type="button"
						onClick={() => setPlaying(!playing)}
						className="toolbar-btn toolbar-btn--icon"
						aria-label={playing ? 'Pause the demo' : 'Play the demo'}
					>
						{playing ? <Pause size={14} /> : <Play size={14} />}
					</button>
					<a
						href={`/?example=${EXAMPLE}`}
						onClick={() => track('home_preview_clicked', { example: EXAMPLE })}
						className="toolbar-btn"
					>
						Open in editor <span aria-hidden="true">→</span>
					</a>
				</div>
			</figcaption>

			<div className="flex flex-wrap gap-x-4 gap-y-1 px-5 pb-4 text-xs text-faint">
				{(Object.keys(STATUS_LABEL) as TickStatus[]).map((status) => (
					<span key={status} className="inline-flex items-center gap-1.5">
						<span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[status] }} />
						{STATUS_LABEL[status]}
					</span>
				))}
				<span className="inline-flex items-center gap-1.5">
					<span className="h-2 w-2 rounded-full border border-border" />
					Not ticked
				</span>
			</div>
		</figure>
	);
};
