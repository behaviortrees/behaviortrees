import React, { createContext, memo, useContext, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, { Edge, Handle, Node as FlowNode, NodeProps, Position, ReactFlowInstance } from 'reactflow';
import 'reactflow/dist/style.css';
import { cn } from '../../lib/utils';
import { Block, Tree } from '../../types';
import { NodeStatus, STATUS_COLOR } from './preview-status';

// The React Flow half of the home preview, loaded lazily so React Flow stays
// out of the first page load. On narrow screens the whole tree is too small
// to read, so the camera follows the evaluation instead: it zooms in on each
// leaf with its parent, then back out for the tick's result.

const FIT_VIEW = { padding: 0.08 };
const NARROW = 560;
const FOLLOW_ZOOM = 0.85;
const MOVE_MS = 450;

const StatusContext = createContext<Record<string, NodeStatus>>({});

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

type TreePreviewCanvasProps = {
	tree: Tree;
	statuses: Record<string, NodeStatus>;
	// The leaf to follow on narrow screens; none means show the whole tree
	focusId?: string;
	animate: boolean;
};

const TreePreviewCanvas: React.FC<TreePreviewCanvasProps> = ({ tree, statuses, focusId, animate }) => {
	const wrapperRef = useRef<HTMLDivElement>(null);
	const [flow, setFlow] = useState<ReactFlowInstance | null>(null);
	const [width, setWidth] = useState(0);

	const nodes = useMemo<FlowNode<Block>[]>(
		() =>
			Object.values(tree.blocks).map((block) => ({
				id: block.id,
				type: 'preview',
				position: block.position,
				data: block,
			})),
		[tree]
	);

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

	// fitView only runs on init; track the column's width to keep it framed
	useEffect(() => {
		const el = wrapperRef.current;
		if (!el || typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(() => setWidth(el.clientWidth));
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	const narrow = width > 0 && width < NARROW;

	useEffect(() => {
		if (!flow) return;
		const duration = animate && narrow ? MOVE_MS : 0;
		const leaf = narrow && focusId ? flow.getNode(focusId) : undefined;
		const parentId = Object.values(tree.connections).find((c) => c.target === focusId)?.source;
		const parent = parentId ? flow.getNode(parentId) : undefined;
		const center = (node?: FlowNode) =>
			node?.positionAbsolute && node.width && node.height
				? { x: node.positionAbsolute.x + node.width / 2, y: node.positionAbsolute.y + node.height / 2 }
				: undefined;
		const leafCenter = center(leaf);
		if (leafCenter) {
			// Frame the leaf with its parent so the branch it belongs to is visible
			const parentCenter = center(parent) ?? leafCenter;
			flow.setCenter((leafCenter.x + parentCenter.x) / 2, leafCenter.y, { zoom: FOLLOW_ZOOM, duration });
		} else {
			flow.fitView({ ...FIT_VIEW, duration });
		}
	}, [flow, tree, narrow, width, focusId, animate]);

	return (
		<div ref={wrapperRef} className="h-full w-full">
			<StatusContext.Provider value={statuses}>
				<ReactFlow
					nodes={nodes}
					edges={edges}
					nodeTypes={nodeTypes}
					onInit={setFlow}
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
	);
};

export default TreePreviewCanvas;
