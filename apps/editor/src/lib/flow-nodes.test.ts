import type { Node } from 'reactflow';
import { describe, expect, it } from 'vitest';

import { mergeFlowNodes } from './flow-nodes';

const node = (id: string, x = 0, y = 0, extra: Record<string, unknown> = {}): Node => ({
  id,
  type: 'action',
  position: { x, y },
  data: { id, name: id, position: { x, y }, ...extra },
});

describe('mergeFlowNodes', () => {
  it('uses the store nodes when the canvas is empty', () => {
    const flow = [node('a')];
    expect(mergeFlowNodes([], flow)).toBe(flow);
  });

  it('replaces the canvas when switching to a tree with the same number of blocks', () => {
    const previousTree = [node('a1', 0, 0), node('a2', 100, 0)];
    const nextTree = [node('b1', 15, 30), node('b2', 45, 60)];

    const merged = mergeFlowNodes(previousTree, nextTree);

    expect(merged.map(n => n.id)).toEqual(['b1', 'b2']);
    expect(merged.map(n => n.position)).toEqual([{ x: 15, y: 30 }, { x: 45, y: 60 }]);
  });

  it('replaces the canvas when one block is swapped for another', () => {
    const merged = mergeFlowNodes([node('a', 90, 90), node('b')], [node('a'), node('c', 30, 30)]);

    expect(merged.map(n => n.id)).toEqual(['a', 'c']);
    expect(merged[0].position).toEqual({ x: 90, y: 90 });
    expect(merged[1].position).toEqual({ x: 30, y: 30 });
  });

  it('keeps canvas positions when blocks are added', () => {
    const merged = mergeFlowNodes([node('a', 90, 90)], [node('a'), node('b', 30, 30)]);

    expect(merged.map(n => n.id)).toEqual(['a', 'b']);
    expect(merged[0].position).toEqual({ x: 90, y: 90 });
  });

  it('returns the current nodes when only positions differ', () => {
    const current = [node('a', 90, 90)];
    expect(mergeFlowNodes(current, [node('a', 0, 0)])).toBe(current);
  });

  it('updates data but keeps canvas positions when a block changes', () => {
    const merged = mergeFlowNodes([node('a', 90, 90)], [node('a', 0, 0, { title: 'Renamed' })]);

    expect(merged[0].data.title).toBe('Renamed');
    expect(merged[0].position).toEqual({ x: 90, y: 90 });
    expect(merged[0].data.position).toEqual({ x: 90, y: 90 });
  });
});
