import React from 'react';
import { NodeProps, useReactFlow } from 'reactflow';
import { GitFork, PenLine, Trash2 } from 'lucide-react';
import { descendantIds } from '../../lib/behavior/organize';
import { useProjectStore } from '../../stores/useProjectStore';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger
} from '../ui/context-menu';

interface NodeContextMenuProps {
  node: NodeProps;
  children: React.ReactNode;
}

const NodeContextMenu: React.FC<NodeContextMenuProps> = ({ node, children }) => {
  const selectedTreeId = useProjectStore((state) => state.project?.selectedTreeId);
  const deleteBlock = useProjectStore((state) => state.deleteBlock);
  const updateBlock = useProjectStore((state) => state.updateBlock);
  const { setNodes } = useReactFlow();

  const handleDelete = () => {
    if (selectedTreeId) {
      deleteBlock(selectedTreeId, node.id);
    }
  };

  const handleRename = () => {
    if (selectedTreeId) {
      const newTitle = prompt('Enter new title:', node.data.label);
      if (newTitle) {
        updateBlock(selectedTreeId, node.id, { title: newTitle });
      }
    }
  };

  // Select this node and everything below it, so one drag moves the branch
  const handleSelectBranch = () => {
    const tree = selectedTreeId && useProjectStore.getState().project?.trees[selectedTreeId];
    if (!tree) return;
    const branch = new Set([node.id, ...descendantIds(tree, [node.id])]);
    setNodes(nodes => nodes.map(n => ({ ...n, selected: branch.has(n.id) })));
  };

  // Prevent context menu for root nodes
  if (node.data.category === 'root') {
    return <>{children}</>;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        <ContextMenuItem onClick={handleRename}>
          <PenLine className="mr-2 h-4 w-4" />
          Rename
        </ContextMenuItem>
        <ContextMenuItem onClick={handleSelectBranch}>
          <GitFork className="mr-2 h-4 w-4" />
          Select branch
          <ContextMenuShortcut>Alt+Drag</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-danger-soft focus:bg-danger/15 focus:text-danger-soft"
          onClick={handleDelete}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled>
          Node Type: {node.data.category}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default NodeContextMenu;