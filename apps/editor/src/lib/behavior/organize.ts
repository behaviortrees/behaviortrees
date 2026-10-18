import { Block, Tree } from '../../types';

// Derived from behavior3editor's OrganizeManager (MIT, © 2014 Renato de
// Pontes Pereira) — see LICENSE-MIT at the package root.
//
// Port of the old editor's OrganizeManager: leaves stack along the cross
// axis at their depth, internal nodes center on their children, and the
// whole layout is offset so the root keeps its current position.

export type TreeLayout = 'horizontal' | 'vertical';

export const LAYOUT_STORAGE_KEY = 'bt-layout';

export function readTreeLayout(): TreeLayout {
  try {
    return localStorage.getItem(LAYOUT_STORAGE_KEY) === 'vertical' ? 'vertical' : 'horizontal';
  } catch {
    return 'horizontal';
  }
}

type Point = { x: number; y: number };

// Siblings run in on-screen order: top-to-bottom in horizontal layout,
// left-to-right in vertical (like the old editor's ExportManager). Organize,
// export and the canvas order badges all share this so they always agree.
export function compareSiblings(layout: TreeLayout) {
  return (a: Point, b: Point): number =>
    layout === 'horizontal' ? a.y - b.y || a.x - b.x : a.x - b.x || a.y - b.y;
}

export function childIdsInOrder(tree: Tree, blockId: string, layout: TreeLayout): string[] {
  const byPosition = compareSiblings(layout);
  return Object.values(tree.connections)
    .filter((c) => c.source === blockId)
    .map((c) => tree.blocks[c.target])
    .filter((b): b is Block => !!b)
    .sort((a, b) => byPosition(a.position, b.position))
    .map((b) => b.id);
}

const H_SPACING = 208;
const V_SPACING = 88;
const V_COMPENSATION = 42;

// Every block below the given ones (not including them), following
// connections; tolerates cycles
export function descendantIds(tree: Tree, blockIds: string[]): string[] {
  const seen = new Set(blockIds);
  const found: string[] = [];
  const queue = [...blockIds];
  while (queue.length > 0) {
    const id = queue.shift()!;
    Object.values(tree.connections).forEach((c) => {
      if (c.source === id && tree.blocks[c.target] && !seen.has(c.target)) {
        seen.add(c.target);
        found.push(c.target);
        queue.push(c.target);
      }
    });
  }
  return found;
}

// `orderLayout` is the layout the tree is currently drawn in: switching
// layouts must read sibling order along the old axis, not the new one.
export function organizeTree(
  tree: Tree,
  layout: TreeLayout = 'horizontal',
  byIndex = false,
  orderLayout: TreeLayout = layout,
): void {
  if (!tree.rootId || !tree.blocks[tree.rootId]) return;

  const root = tree.blocks[tree.rootId];
  const offsetX = root.position.x;
  const offsetY = root.position.y;

  const childIdsOf = (blockId: string): string[] =>
    byIndex
      ? Object.values(tree.connections)
          .filter((c) => c.source === blockId && !!tree.blocks[c.target])
          .map((c) => c.target)
      : childIdsInOrder(tree, blockId, orderLayout);

  let leafCount = 0;
  const visited = new Set<string>();
  const placed: string[] = [];

  const step = (blockId: string, depth: number): number => {
    if (visited.has(blockId)) return 0;
    visited.add(blockId);
    placed.push(blockId);

    const block = tree.blocks[blockId];
    const children = childIdsOf(blockId);
    let cross: number;

    if (children.length === 0) {
      leafCount += 1;
      cross = leafCount * (layout === 'horizontal' ? V_SPACING : H_SPACING);
    } else {
      let sum = 0;
      children.forEach((childId) => {
        sum += step(childId, depth + 1);
      });
      cross = sum / children.length;
    }

    if (layout === 'horizontal') {
      block.position = { x: depth * H_SPACING, y: cross };
    } else {
      block.position = { x: cross, y: depth * (V_SPACING + V_COMPENSATION) };
    }
    return cross;
  };

  step(tree.rootId, 0);

  // Keep the root where it was; shift everything else with it
  const dx = offsetX - root.position.x;
  const dy = offsetY - root.position.y;
  placed.forEach((id) => {
    const block = tree.blocks[id];
    block.position = { x: block.position.x + dx, y: block.position.y + dy };
  });
}
