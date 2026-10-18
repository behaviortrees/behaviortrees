import { Block, Tree } from '../../types';
import { childIdsInOrder, TreeLayout } from './organize';

// A minimal behavior3 interpreter for previews: it ticks a tree once and
// records the order nodes were entered and left, so the UI can replay the
// traversal. Leaves run no real code; `leafStatus` decides their result.
// Stateful decorators (Repeater, MaxTime, Limiter…) pass their child's
// result through unchanged. Fine for a demo, not a runtime.

export type TickStatus = 'success' | 'failure' | 'running';

export type TickEvent =
  | { type: 'enter'; id: string }
  | { type: 'exit'; id: string; status: TickStatus };

export type TickOptions = {
  layout?: TreeLayout;
  // Running child index per Mem* composite, carried across ticks
  memory?: Map<string, number>;
};

export function tickTree(
  tree: Tree,
  leafStatus: (block: Block) => TickStatus,
  { layout = 'horizontal', memory = new Map() }: TickOptions = {},
): TickEvent[] {
  const events: TickEvent[] = [];
  const visiting = new Set<string>();

  const run = (block: Block, children: string[]): TickStatus => {
    switch (block.category) {
      case 'action':
      case 'condition':
        return leafStatus(block);

      // Priority/MemPriority are selectors; every other composite, custom
      // ones included, runs as a sequence
      case 'composite': {
        const continueOn: TickStatus =
          block.name === 'Priority' || block.name === 'MemPriority' ? 'failure' : 'success';
        const remembers = block.name.startsWith('Mem');
        const start = remembers ? (memory.get(block.id) ?? 0) : 0;
        for (let i = start; i < children.length; i++) {
          const status = tick(children[i]);
          if (status !== continueOn) {
            if (remembers && status === 'running') memory.set(block.id, i);
            else memory.delete(block.id);
            return status;
          }
        }
        memory.delete(block.id);
        return continueOn;
      }

      // Root and decorators have a single child
      default: {
        if (children.length === 0) return 'failure';
        const status = tick(children[0]);
        if (block.name === 'Inverter' && status !== 'running') {
          return status === 'success' ? 'failure' : 'success';
        }
        return status;
      }
    }
  };

  const tick = (id: string): TickStatus => {
    // A cycle can't be ticked; treat the repeat visit as a failed child
    if (visiting.has(id)) return 'failure';
    visiting.add(id);
    events.push({ type: 'enter', id });
    const status = run(tree.blocks[id], childIdsInOrder(tree, id, layout));
    events.push({ type: 'exit', id, status });
    visiting.delete(id);
    return status;
  };

  if (tree.rootId && tree.blocks[tree.rootId]) tick(tree.rootId);
  return events;
}
