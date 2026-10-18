import React, { useCallback } from 'react';
import { EdgeProps, getBezierPath, Position, ReactFlowState, useStore } from 'reactflow';
import { compareSiblings, readTreeLayout } from '../../../lib/behavior/organize';
import EdgeContextMenu from '../edge-context-menu';

const BADGE_OFFSET = 14;

const ContextEdge: React.FC<EdgeProps> = (props) => {
  const {
    id,
    source,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
  } = props;

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // This child's 1-based run order among its siblings, read from live node
  // positions so it updates while dragging. Only shown with 2+ siblings.
  const layout = readTreeLayout();
  const order = useStore(
    useCallback(
      (s: ReactFlowState) => {
        const siblings = s.edges.filter(e => e.source === source);
        if (siblings.length < 2) return null;
        const byPosition = compareSiblings(layout);
        const origin = { x: 0, y: 0 };
        const positionOf = (nodeId: string) => s.nodeInternals.get(nodeId)?.position ?? origin;
        siblings.sort((a, b) => byPosition(positionOf(a.target), positionOf(b.target)));
        return {
          index: siblings.findIndex(e => e.id === id) + 1,
          count: siblings.length,
        };
      },
      [id, source, layout]
    ),
    (a, b) => a?.index === b?.index && a?.count === b?.count
  );

  const badgeX = targetPosition === Position.Left ? targetX - BADGE_OFFSET : targetX;
  const badgeY = targetPosition === Position.Top ? targetY - BADGE_OFFSET : targetY;

  const pathStyle = {
    ...style,
    strokeWidth: 2,
    stroke: '#64748b',
  };

  // Increase the clickable area for the path to make it easier to right-click
  const interactionPath = (
    <path
      id={id}
      d={edgePath}
      fill="none"
      strokeWidth={10}
      stroke="transparent"
      strokeLinecap="round"
      className="cursor-pointer"
    />
  );

  // The actual visible path
  const visualPath = (
    <path
      id={id}
      d={edgePath}
      fill="none"
      style={pathStyle}
      strokeLinecap="round"
      markerEnd={markerEnd}
      className="transition-colors hover:stroke-slate-500 dark:hover:stroke-slate-300"
    />
  );

  return (
    <EdgeContextMenu edge={props}>
      <g>
        {interactionPath}
        {visualPath}
        {order && (
          <g data-testid="edge-order" transform={`translate(${badgeX}, ${badgeY})`}>
            <title>
              {`Runs ${order.index} of ${order.count}. Siblings run ${
                layout === 'horizontal' ? 'top to bottom' : 'left to right'
              }; drag a node to reorder it.`}
            </title>
            <circle r={8} className="fill-slate-500 dark:fill-slate-400" />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-white text-[10px] font-semibold select-none dark:fill-slate-900"
            >
              {order.index}
            </text>
          </g>
        )}
      </g>
    </EdgeContextMenu>
  );
};

export default ContextEdge;