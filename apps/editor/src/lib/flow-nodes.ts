import type { Node } from 'reactflow';

const sameIds = (a: Node[], b: Node[]) => {
  if (a.length !== b.length) return false;
  const ids = new Set(a.map(node => node.id));
  return b.every(node => ids.has(node.id));
};

// Merges the nodes built from the store into the canvas's current nodes.
// Positions on the canvas win over the store's (drags commit asynchronously),
// and when only positions differ the current array is returned unchanged so
// React Flow doesn't re-render.
export const mergeFlowNodes = (currentNodes: Node[], flowNodes: Node[]): Node[] => {
  if (currentNodes.length === 0) return flowNodes;

  // Blocks were added, removed or replaced (a tree switch replaces them all):
  // the store's set of blocks is authoritative
  if (!sameIds(currentNodes, flowNodes)) {
    const currentById = new Map(currentNodes.map(node => [node.id, node]));
    return flowNodes.map(newNode => {
      const existing = currentById.get(newNode.id);
      return existing ? { ...newNode, position: existing.position } : newNode;
    });
  }

  const flowById = new Map(flowNodes.map(node => [node.id, node]));
  const changed = currentNodes.some(node => {
    const { position: _newPosition, ...newData } = flowById.get(node.id)!.data;
    const { position: _existingPosition, ...existingData } = node.data;
    return JSON.stringify(newData) !== JSON.stringify(existingData);
  });
  if (!changed) return currentNodes;

  return currentNodes.map(node => {
    const newNode = flowById.get(node.id)!;
    return {
      ...newNode,
      position: node.position,
      data: { ...newNode.data, position: node.position },
    };
  });
};
