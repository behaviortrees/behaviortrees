import { TickStatus } from '../../lib/behavior/simulate';

// Shared by the home preview's shell and its lazily loaded canvas

// 'active' marks a composite whose children are still being evaluated
export type NodeStatus = TickStatus | 'active';

export const STATUS_COLOR: Record<NodeStatus, string> = {
	active: 'var(--bt-accent)',
	running: 'var(--warning)',
	success: 'var(--success)',
	failure: 'var(--danger)',
};

export const STATUS_LABEL: Record<TickStatus, string> = {
	running: 'Running',
	success: 'Success',
	failure: 'Failure',
};
