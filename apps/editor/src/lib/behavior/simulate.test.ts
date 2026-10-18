import { describe, expect, it } from 'vitest';
import enemyPatrol from '@behaviortrees/examples/trees/enemy-patrol.json';
import { Block, NodeCategory, Tree } from '../../types';
import { B3Tree, b3ToTree } from './b3';
import { DEFAULT_NODES } from './defaults';
import { tickTree, TickEvent, TickStatus } from './simulate';

type Spec = { id: string; name: string; category: NodeCategory; children?: Spec[] };

// Builds a horizontal-layout tree: siblings are stacked top-to-bottom in
// the order given, which is the order they run in
const build = (root: Spec): Tree => {
  const tree: Tree = { id: 't', title: 't', blocks: {}, connections: {}, rootId: root.id, viewport: { x: 0, y: 0, zoom: 1 } };
  const add = (spec: Spec, depth: number, row: number) => {
    tree.blocks[spec.id] = { id: spec.id, name: spec.name, category: spec.category, properties: {}, position: { x: depth * 200, y: row * 100 } };
    spec.children?.forEach((child, i) => {
      tree.connections[`${spec.id}-${child.id}`] = { id: `${spec.id}-${child.id}`, source: spec.id, target: child.id };
      add(child, depth + 1, row * 10 + i);
    });
  };
  add(root, 0, 0);
  return tree;
};

const leaf = (id: string): Spec => ({ id, name: id, category: 'action' });
const results = (map: Record<string, TickStatus>) => (block: Block) => map[block.id] ?? 'failure';
const visited = (events: TickEvent[]) => events.filter((e) => e.type === 'enter').map((e) => e.id);
const exitOf = (events: TickEvent[], id: string) =>
  events.find((e): e is Extract<TickEvent, { type: 'exit' }> => e.type === 'exit' && e.id === id)?.status;

describe('tickTree', () => {
  it('stops a sequence at the first child that does not succeed', () => {
    const tree = build({ id: 'root', name: 'Root', category: 'root', children: [
      { id: 'seq', name: 'Sequence', category: 'composite', children: [leaf('a'), leaf('b'), leaf('c')] },
    ] });
    const events = tickTree(tree, results({ a: 'success', b: 'failure', c: 'success' }));
    expect(visited(events)).toEqual(['root', 'seq', 'a', 'b']);
    expect(exitOf(events, 'root')).toBe('failure');
  });

  it('falls through a priority until a child does not fail', () => {
    const tree = build({ id: 'p', name: 'Priority', category: 'composite', children: [leaf('a'), leaf('b'), leaf('c')] });
    const events = tickTree(tree, results({ a: 'failure', b: 'running' }));
    expect(visited(events)).toEqual(['p', 'a', 'b']);
    expect(exitOf(events, 'p')).toBe('running');
  });

  it('records enter before children and exit after them', () => {
    const tree = build({ id: 'seq', name: 'Sequence', category: 'composite', children: [leaf('a')] });
    expect(tickTree(tree, results({ a: 'success' }))).toEqual([
      { type: 'enter', id: 'seq' },
      { type: 'enter', id: 'a' },
      { type: 'exit', id: 'a', status: 'success' },
      { type: 'exit', id: 'seq', status: 'success' },
    ]);
  });

  it('inverts success and failure but not running', () => {
    const tree = build({ id: 'inv', name: 'Inverter', category: 'decorator', children: [leaf('a')] });
    expect(exitOf(tickTree(tree, results({ a: 'success' })), 'inv')).toBe('failure');
    expect(exitOf(tickTree(tree, results({ a: 'running' })), 'inv')).toBe('running');
  });

  it('resumes a MemSequence from its running child on the next tick', () => {
    const tree = build({ id: 'm', name: 'MemSequence', category: 'composite', children: [leaf('a'), leaf('b')] });
    const memory = new Map<string, number>();
    tickTree(tree, results({ a: 'success', b: 'running' }), { memory });
    const events = tickTree(tree, results({ a: 'success', b: 'success' }), { memory });
    expect(visited(events)).toEqual(['m', 'b']);
    expect(memory.size).toBe(0);
  });

  it('ticks the enemy patrol example down to the patrol branch', () => {
    const { tree } = b3ToTree(enemyPatrol as B3Tree, DEFAULT_NODES);
    const byName = (block: Block): TickStatus => (block.name === 'MoveToWaypoint' ? 'running' : 'failure');
    const events = tickTree(tree, byName);
    const names = visited(events).map((id) => tree.blocks[id].title);
    expect(names).toEqual([
      'Enemy Patrol AI', 'Enemy AI',
      'Attack', 'Is Player In Range?',
      'Chase', 'Is Player Visible?',
      'Patrol', 'Move To Waypoint',
    ]);
    expect(exitOf(events, tree.rootId!)).toBe('running');
  });
});
