import enemyPatrol from '@behaviortrees/examples/trees/enemy-patrol.json';
import { Pause, Play } from 'lucide-react';
import React, { createContext, memo, useContext, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, { Edge, Handle, Node as FlowNode, NodeProps, Position, ReactFlowInstance } from 'reactflow';
import 'reactflow/dist/style.css';
import { track } from '../../lib/analytics';
import { B3Tree, b3ToTree } from '../../lib/behavior/b3';
import { DEFAULT_NODES } from '../../lib/behavior/defaults';
import { tickTree, TickEvent, TickStatus } from '../../lib/behavior/simulate';
import { cn } from '../../lib/utils';
import { Block } from '../../types';

// A read-only, auto-playing run of the enemy patrol example for the home
// page. Each frame is one tick of the real tree against a scripted world;
// the traversal replays one node at a time so visitors can watch the
// selector fall through and the sequences short-circuit.

const EXAMPLE = 'enemy-patrol';
const STEP_MS = 170;
const HOLD_MS = 1600;
const FIT_VIEW = { padding: 0.08 };

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

// 'active' marks a composite whose children are still being evaluated
type NodeStatus = TickStatus | 'active';

const StatusContext = createContext<Record<string, NodeStatus>>({});

const STATUS_COLOR: Record<NodeStatus, string> = {
	active: 'var(--bt-accent)',
	running: 'var(--warning)',
	success: 'var(--success)',
	failure: 'var(--danger)',
};

const STATUS_LABEL: Record<TickStatus, string> = {
	running: 'Running',
	success: 'Success',
	failure: 'Failure',
};

const kindOf = (block: Block): string => {
	if (block.category === 'composite' || block.category === 'decorator') return block.name;
	return block.category.charAt(0).toUpperCase() + block.category.slice(1);
};

const PreviewNode: React.FC<NodeProps<Block>> = memo(({ id, data }) => {
	const status = useContext(StatusContext)[id];
	const color = status ? STATUS_COLOR[status] : undefined;

	return (
		<div
			className={cn(
				'min-w-[150px] rounded-md border border-l-[3px] bg-raised px-3 py-1.5 transition-[border-color,box-shadow,opacity] duration-200',
				!status && 'opacity-55'
			)}
			style={{
				// Per side: React warns when borderColor and borderLeftColor mix
				borderTopColor: color,
				borderRightColor: color,
				borderBottomColor: color,
				borderLeftColor: `var(--color-cat-${data.category})`,
				boxShadow: color ? `0 0 0 1px ${color}, 0 0 14px color-mix(in srgb, ${color} 35%, transparent)` : undefined,
			}}
		>
			{data.category !== 'root' && (
				<Handle type="target" position={Position.Left} isConnectable={false} className="!h-1.5 !w-1.5 !min-w-0 !border-0 !bg-edge" />
			)}
			<div className="text-[10px] font-medium uppercase tracking-[0.12em] text-faint">{kindOf(data)}</div>
			<div className="flex items-center justify-between gap-3 whitespace-nowrap text-[13px] text-fg">
				{data.title || data.name}
				<span
					className="h-2 w-2 shrink-0 rounded-full transition-colors duration-200"
					style={{ background: color ?? 'transparent' }}
				/>
			</div>
			{(data.category === 'root' || data.category === 'composite' || data.category === 'decorator') && (
				<Handle type="source" position={Position.Right} isConnectable={false} className="!h-1.5 !w-1.5 !min-w-0 !border-0 !bg-edge" />
			)}
		</div>
	);
});

const nodeTypes = { preview: PreviewNode };

const buildPreview = () => {
	const { tree } = b3ToTree(enemyPatrol as B3Tree, DEFAULT_NODES);
	Object.values(tree.blocks).forEach((block) => {
		block.position = { x: block.position.x, y: Math.round(block.position.y * ROW_SCALE) };
	});

	const nodes: FlowNode<Block>[] = Object.values(tree.blocks).map((block) => ({
		id: block.id,
		type: 'preview',
		position: block.position,
		data: block,
	}));

	const isLeaf = (id: string) => ['action', 'condition'].includes(tree.blocks[id].category);
	const memory = new Map<string, number>();
	const ticks: TickEvent[][] = FRAMES.map((frame) =>
		tickTree(tree, (block) => frame.leaves[block.name] ?? 'failure', { memory })
			// A leaf shows its result straight away instead of an 'active' beat
			.filter((event) => event.type === 'exit' || !isLeaf(event.id))
	);

	return { tree, nodes, ticks };
};

const prefersReducedMotion = () => {
	try {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	} catch {
		return false;
	}
};

export const TreePreview: React.FC = () => {
	const { tree, nodes, ticks } = useMemo(buildPreview, []);
	const [playing, setPlaying] = useState(() => !prefersReducedMotion());
	const [frame, setFrame] = useState(0);
	// Reduced motion starts paused on a fully evaluated first tick
	const [step, setStep] = useState(() => (prefersReducedMotion() ? ticks[0].length : 0));
	const wrapperRef = useRef<HTMLDivElement>(null);
	const flowRef = useRef<ReactFlowInstance | null>(null);

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

	// fitView only runs on init; keep the tree framed as the column resizes
	useEffect(() => {
		const el = wrapperRef.current;
		if (!el || typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(() => flowRef.current?.fitView(FIT_VIEW));
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	const statuses = useMemo(() => {
		const map: Record<string, NodeStatus> = {};
		events.slice(0, step).forEach((event) => {
			map[event.id] = event.type === 'enter' ? 'active' : event.status;
		});
		return map;
	}, [events, step]);

	const edges = useMemo<Edge[]>(
		() =>
			Object.values(tree.connections).map((connection) => {
				const status = statuses[connection.target];
				return {
					id: connection.id,
					source: connection.source,
					target: connection.target,
					animated: status === 'running' || status === 'active',
					style: {
						stroke: status ? STATUS_COLOR[status] : 'var(--edge)',
						strokeWidth: status ? 2 : 1.25,
						opacity: status ? 1 : 0.5,
					},
				};
			}),
		[tree, statuses]
	);

	const result = done ? statuses[tree.rootId!] : undefined;

	return (
		<figure className="card mb-12 !p-0 overflow-hidden">
			<div ref={wrapperRef} className="h-[260px] sm:h-[400px] border-b border-border" aria-hidden="true">
				<StatusContext.Provider value={statuses}>
					<ReactFlow
						nodes={nodes}
						edges={edges}
						nodeTypes={nodeTypes}
						onInit={(instance) => {
							flowRef.current = instance;
						}}
						fitView
						fitViewOptions={FIT_VIEW}
						minZoom={0.2}
						nodesDraggable={false}
						nodesConnectable={false}
						nodesFocusable={false}
						edgesFocusable={false}
						elementsSelectable={false}
						panOnDrag={false}
						panOnScroll={false}
						zoomOnScroll={false}
						zoomOnPinch={false}
						zoomOnDoubleClick={false}
						preventScrolling={false}
						proOptions={{ hideAttribution: true }}
					/>
				</StatusContext.Provider>
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
