import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node as FlowNode,
  Connection,
  NodeChange,
  EdgeChange,
  BackgroundVariant,
  NodeTypes,
  EdgeTypes,
  OnConnectStart,
  OnConnectEnd,
  ReactFlowInstance,
  NodeDragHandler,
  NodePositionChange,
  Position,
  SelectionDragHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { descendantIds, readTreeLayout } from '../../lib/behavior/organize';
import { useProjectStore } from '../../stores/useProjectStore';
import { Block } from '../../types';
import EditorLayout from '../layouts/editor-layout';
import TreesPanel from '../panels/trees-panel';
import NodesPanel from '../panels/nodes-panel';
import PropertiesPanel from '../panels/properties-panel';

// Custom node components
import CompositeNode from './nodes/composite-node';
import DecoratorNode from './nodes/decorator-node';
import ActionNode from './nodes/action-node';
import ConditionNode from './nodes/condition-node';
import RootNode from './nodes/root-node';

// Custom edge component
import ContextEdge from './edges/context-edge';

// Node types registry for ReactFlow
const nodeTypes: NodeTypes = {
  composite: CompositeNode,
  decorator: DecoratorNode,
  action: ActionNode,
  condition: ConditionNode,
  root: RootNode,
};

// Edge types registry for ReactFlow
const edgeTypes: EdgeTypes = {
  default: ContextEdge,
};

// Handles follow the persisted layout direction: parent → child flows
// left-to-right in horizontal layout, top-to-bottom in vertical
const getHandlePositions = () => {
  const vertical = readTreeLayout() === 'vertical';
  return {
    sourcePosition: vertical ? Position.Bottom : Position.Right,
    targetPosition: vertical ? Position.Top : Position.Left,
  };
};

const BehaviorTreeEditor: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const connectingNodeId = useRef<string | null>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);

  // Get project data and methods from store
  const project = useProjectStore(state => state.project);
  const selectedTreeId = useProjectStore(state => state.project?.selectedTreeId);
  const createBlock = useProjectStore(state => state.createBlock);
  const updateBlock = useProjectStore(state => state.updateBlock);
  const moveBlocks = useProjectStore(state => state.moveBlocks);
  const deleteBlock = useProjectStore(state => state.deleteBlock);
  const createConnection = useProjectStore(state => state.createConnection);
  const deleteConnection = useProjectStore(state => state.deleteConnection);
  const undo = useProjectStore(state => state.undo);
  const redo = useProjectStore(state => state.redo);
  const copyBlocks = useProjectStore(state => state.copyBlocks);
  const cutBlocks = useProjectStore(state => state.cutBlocks);
  const pasteClipboard = useProjectStore(state => state.pasteClipboard);
  const duplicateBlocks = useProjectStore(state => state.duplicateBlocks);
  const organize = useProjectStore(state => state.organize);

  // Get editor settings from localStorage
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [autoSave, setAutoSave] = useState<boolean>(false);

  // Load settings
  useEffect(() => {
    const savedShowGrid = localStorage.getItem('bt-show-grid') !== 'false'; // Default to true
    const savedAutoSave = localStorage.getItem('bt-auto-save') === 'true';

    setShowGrid(savedShowGrid);
    setAutoSave(savedAutoSave);

    // Listen for storage events to update settings in real-time
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'bt-show-grid') {
        setShowGrid(e.newValue !== 'false');
      } else if (e.key === 'bt-auto-save') {
        setAutoSave(e.newValue === 'true');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Bumped to force a rebuild from the store even when the project itself
  // didn't change (e.g. undo with an empty history)
  const [refreshCount, setRefreshCount] = useState(0);

  // Cache to store previous positions of nodes
  const prevNodePositionsRef = useRef<{[key: string]: {x: number, y: number}}>({});

  // Convert project tree data to ReactFlow nodes and edges
  const syncTreeToFlow = useCallback(() => {
    if (!project || !selectedTreeId || !project.trees[selectedTreeId]) {
      setNodes([]);
      setEdges([]);
      // Clear the position cache when tree changes
      prevNodePositionsRef.current = {};
      return;
    }

    const tree = project.trees[selectedTreeId];

    // Get previous positions for comparison (create if doesn't exist)
    const prevPositions = prevNodePositionsRef.current;

    const handlePositions = getHandlePositions();

    // Convert blocks to nodes
    const flowNodes = Object.values(tree.blocks).map((block: Block) => {
      // Check if we should use a cached position
      const nodeId = block.id;
      const cachedPosition = prevPositions[nodeId];

      // If we have a cached position, and it's not the node being dragged, use it
      let position = block.position;
      if (cachedPosition) {
        position = cachedPosition;
      } else {
        // Store this position for future reference if it's not cached yet
        prevPositions[nodeId] = {...block.position};
      }

      return {
        id: nodeId,
        type: block.category,
        position,
        ...handlePositions,
        data: {
          ...block,
          label: block.title || block.name,
        },
      };
    });

    // Convert connections to edges
    const flowEdges = Object.values(tree.connections).map((connection) => ({
      id: connection.id,
      source: connection.source,
      target: connection.target,
      animated: true,
      type: 'default',
    }));

    // Only update nodes if there are new nodes or node data changes
    setNodes(currentNodes => {
      // First time setup - just use the provided nodes
      if (currentNodes.length === 0) {
        return flowNodes;
      }

      // If node count changes, we need to update
      if (currentNodes.length !== flowNodes.length) {
        // Create a mapping of existing nodes by ID to preserve positions
        const currentNodeMap = new Map(
          currentNodes.map(node => [node.id, node])
        );

        // Return new nodes but preserve positions of existing ones
        return flowNodes.map(newNode => {
          const existingNode = currentNodeMap.get(newNode.id);
          if (existingNode) {
            // Preserve position of existing node
            return {
              ...newNode,
              position: existingNode.position
            };
          }
          return newNode;
        });
      }

      // Compare nodes to see if any data (except position) has changed
      // This avoids unnecessary rerenders when only UI state changes
      const nodeChanges = flowNodes.filter(newNode => {
        const existingNode = currentNodes.find(node => node.id === newNode.id);
        if (!existingNode) return true;

        // Compare data except position
        const { position: _newPosition, ...newDataNoPos } = newNode.data;
        const { position: _existingPosition, ...existingDataNoPos } = existingNode.data;

        return JSON.stringify(newDataNoPos) !== JSON.stringify(existingDataNoPos);
      });

      // If no data changes, keep current state to avoid re-renders
      if (nodeChanges.length === 0) {
        return currentNodes;
      }

      // Update nodes while preserving positions
      return currentNodes.map(node => {
        const newNode = flowNodes.find(n => n.id === node.id);
        if (!newNode) return node;

        // Preserve position but update data
        return {
          ...newNode,
          position: node.position,
          data: {
            ...newNode.data,
            position: node.position // Ensure data position is also updated
          }
        };
      });
    });

    // Similar approach for edges - only update if needed
    setEdges(currentEdges => {
      if (currentEdges.length !== flowEdges.length) {
        return flowEdges;
      }

      // Check if any edge data has changed
      const edgeChanges = flowEdges.filter(newEdge => {
        const existingEdge = currentEdges.find(edge => edge.id === newEdge.id);
        if (!existingEdge) return true;

        return (
          existingEdge.source !== newEdge.source ||
          existingEdge.target !== newEdge.target
        );
      });

      // If no changes, keep current edges to avoid re-renders
      if (edgeChanges.length === 0) {
        return currentEdges;
      }

      return flowEdges;
    });
  }, [project, selectedTreeId, setNodes, setEdges]);

  // When selected tree changes, update the flow
  useEffect(() => {
    syncTreeToFlow();
  }, [syncTreeToFlow, refreshCount]);

  // Switching trees (including after an import) invalidates the position
  // cache and needs the viewport refit to the new tree's blocks
  const lastTreeIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (selectedTreeId === lastTreeIdRef.current) return;
    lastTreeIdRef.current = selectedTreeId;
    prevNodePositionsRef.current = {};
    if (reactFlowInstance) {
      // Wait for the synced nodes to render before fitting
      const id = window.setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.15, maxZoom: 1 });
      }, 50);
      return () => window.clearTimeout(id);
    }
  }, [selectedTreeId, reactFlowInstance]);

  // Handle node selection
  const onNodeClick = useCallback((_: React.MouseEvent, node: FlowNode) => {
    setSelectedNode(node);
  }, []);

  // Store positions changed under the canvas (undo/redo/organize): the
  // position cache would override them, so drop it and rebuild from store
  const refreshFromStore = useCallback(() => {
    prevNodePositionsRef.current = {};
    setNodes([]);
    setRefreshCount(count => count + 1);
  }, [setNodes]);

  // Toolbar buttons live outside this component; they announce store-side
  // position changes through this event
  useEffect(() => {
    const handler = () => refreshFromStore();
    window.addEventListener('bt-canvas-refresh', handler);
    return () => window.removeEventListener('bt-canvas-refresh', handler);
  }, [refreshFromStore]);

  // Keyboard shortcuts matching the old editor's menubar bindings
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (!project || !selectedTreeId) return;

      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      const selectedIds = nodes.filter(n => n.selected).map(n => n.id);

      if (mod && key === 'z') {
        e.preventDefault();
        refreshFromStore();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && key === 'y') {
        e.preventDefault();
        refreshFromStore();
        redo();
      } else if (mod && key === 'c') {
        e.preventDefault();
        copyBlocks(selectedTreeId, selectedIds);
      } else if (mod && key === 'x') {
        e.preventDefault();
        cutBlocks(selectedTreeId, selectedIds);
      } else if (mod && key === 'v') {
        e.preventDefault();
        pasteClipboard(selectedTreeId);
      } else if (mod && key === 'd') {
        e.preventDefault();
        duplicateBlocks(selectedTreeId, selectedIds);
      } else if (mod && key === 'a' && e.shiftKey) {
        e.preventDefault();
        setNodes(ns => ns.map(n => ({ ...n, selected: false })));
      } else if (mod && key === 'a') {
        e.preventDefault();
        setNodes(ns => ns.map(n => ({ ...n, selected: true })));
      } else if (mod && key === 'i') {
        e.preventDefault();
        setNodes(ns => ns.map(n => ({ ...n, selected: !n.selected })));
      } else if (!mod && key === 'a') {
        refreshFromStore();
        organize(selectedTreeId, readTreeLayout());
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    project,
    selectedTreeId,
    nodes,
    undo,
    redo,
    copyBlocks,
    cutBlocks,
    pasteClipboard,
    duplicateBlocks,
    organize,
    setNodes,
    refreshFromStore,
  ]);

  // Handle connection creation
  const onConnect = useCallback(
    (connection: Connection) => {
      if (project && selectedTreeId && connection.source && connection.target) {
        // Create connection in the store
        const connectionId = createConnection(selectedTreeId, connection.source, connection.target);

        // Update local edges state for immediate visual feedback
        if (connectionId) {
          const newEdge = {
            id: connectionId,
            source: connection.source,
            target: connection.target,
            animated: true,
            type: 'default',
          };

          // Add to local state
          setEdges(edges => [...edges, newEdge]);

          // Auto-save if enabled
          if (autoSave && project) {
            try {
              requestAnimationFrame(() => {
                useProjectStore.getState().saveProject();
              });
            } catch (error) {
              console.error('Auto-save failed:', error);
            }
          }
        }
      }
    },
    [project, selectedTreeId, createConnection, setEdges, autoSave]
  );

  // Snap moved nodes to the grid and save them to the store as one undo
  // step. `exact` positions skip snapping (branch followers keep their
  // offsets from the dragged node).
  const commitPositions = useCallback(
    (
      moved: Record<string, { x: number, y: number }>,
      exact: Record<string, { x: number, y: number }> = {}
    ) => {
      if (!selectedTreeId) return;
      const snapped: Record<string, { x: number, y: number }> = {};
      Object.entries(moved).forEach(([id, position]) => {
        snapped[id] = {
          x: Math.round(position.x / 15) * 15,
          y: Math.round(position.y / 15) * 15,
        };
      });
      Object.assign(snapped, exact);
      Object.entries(snapped).forEach(([id, position]) => {
        prevNodePositionsRef.current[id] = position;
      });

      setNodes(nodes =>
        nodes.map(node =>
          snapped[node.id]
            ? { ...node, position: snapped[node.id], data: { ...node.data, position: snapped[node.id] } }
            : node
        )
      );

      // Batch the store write after the UI update
      requestAnimationFrame(() => {
        moveBlocks(selectedTreeId, snapped);
        if (autoSave) {
          try {
            useProjectStore.getState().saveProject();
          } catch (error) {
            console.error('Auto-save failed:', error);
          }
        }
      });
    },
    [selectedTreeId, moveBlocks, setNodes, autoSave]
  );

  // Alt+drag moves a node together with everything below it. The dragged
  // nodes are moved by ReactFlow; their descendants follow by the same delta.
  const branchDragRef = useRef<{
    anchor: { x: number, y: number };
    followers: Record<string, { x: number, y: number }>;
  } | null>(null);

  const onNodeDragStart: NodeDragHandler = useCallback(
    (event, node, dragged) => {
      branchDragRef.current = null;
      if (!event.altKey || !project || !selectedTreeId) return;

      const tree = project.trees[selectedTreeId];
      const followerIds = new Set(descendantIds(tree, dragged.map(n => n.id)));
      const followers: Record<string, { x: number, y: number }> = {};
      nodes.forEach(n => {
        if (followerIds.has(n.id)) followers[n.id] = { ...n.position };
      });
      branchDragRef.current = { anchor: { ...node.position }, followers };
    },
    [project, selectedTreeId, nodes]
  );

  const onNodeDrag: NodeDragHandler = useCallback(
    (_, node) => {
      const branch = branchDragRef.current;
      if (!branch) return;
      const dx = node.position.x - branch.anchor.x;
      const dy = node.position.y - branch.anchor.y;
      setNodes(nodes =>
        nodes.map(n => {
          const start = branch.followers[n.id];
          return start ? { ...n, position: { x: start.x + dx, y: start.y + dy } } : n;
        })
      );
    },
    [setNodes]
  );

  const onNodeDragStop: NodeDragHandler = useCallback(
    (_, node, dragged) => {
      const moved: Record<string, { x: number, y: number }> = {};
      dragged.forEach(n => {
        moved[n.id] = n.position;
      });
      const followers: Record<string, { x: number, y: number }> = {};
      const branch = branchDragRef.current;
      branchDragRef.current = null;
      if (branch) {
        const dx = node.position.x - branch.anchor.x;
        const dy = node.position.y - branch.anchor.y;
        Object.entries(branch.followers).forEach(([id, start]) => {
          followers[id] = { x: start.x + dx, y: start.y + dy };
        });
      }
      commitPositions(moved, followers);
    },
    [commitPositions]
  );

  // Dragging the box around a rubber-band selection
  const onSelectionDragStop: SelectionDragHandler = useCallback(
    (_, dragged) => {
      commitPositions(Object.fromEntries(dragged.map(n => [n.id, n.position])));
    },
    [commitPositions]
  );

  // Handle node changes
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // First check if there are changes and if we have a valid project
      if (project && selectedTreeId) {
        const rootId = project.trees[selectedTreeId].rootId;
        const prevPositions = prevNodePositionsRef.current;

        // First, process dragging to update local state immediately for smooth dragging
        const filteredChanges = changes.map(change => {
          if (change.type === 'position' && change.position) {
            // During dragging, we need to update the position in ReactFlow immediately
            // but we'll only update the store when dragging ends
            if (change.dragging) {
              // For visual feedback during drag, allow all changes
              return change;
            }
          }
          return change;
        });

        // Apply filtered changes to the local state for immediate feedback
        onNodesChange(filteredChanges);

        // Keyboard nudges arrive as finished position changes; drags carry
        // no position when they end and are committed in onNodeDragStop
        const positionChanges = filteredChanges.filter(
          (change): change is NodePositionChange =>
            change.type === 'position' && !!change.position && change.dragging === false
        );

        if (positionChanges.length > 0) {
          commitPositions(
            Object.fromEntries(positionChanges.map(change => [change.id, change.position!]))
          );
        }

        // Handle node removals - never allow removal of the root node
        const removeChanges = filteredChanges.filter(change =>
          change.type === 'remove' && change.id !== rootId // Prevent root node deletion
        );

        if (removeChanges.length > 0) {
          removeChanges.forEach(change => {
            // Ensure change is of type 'remove' before accessing id
            if (change.type === 'remove' && change.id) {
              // Remove from position cache
              if (prevPositions[change.id]) {
                delete prevPositions[change.id];
              }

              // Remove from store
              deleteBlock(selectedTreeId, change.id);
            }
          });

          // Auto-save after node removal
          if (autoSave && project) {
            try {
              useProjectStore.getState().saveProject();
            } catch (error) {
              console.error('Auto-save failed:', error);
            }
          }
        }
      } else {
        // If no project or selected tree, just apply changes to the UI
        onNodesChange(changes);
      }
    },
    [project, selectedTreeId, deleteBlock, onNodesChange, commitPositions, autoSave]
  );

  // Handle edge changes (deletions)
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // First apply changes to the local state for immediate feedback
      onEdgesChange(changes);

      // Then update the store
      const removeChanges = changes.filter(change => change.type === 'remove');
      if (project && selectedTreeId && removeChanges.length > 0) {
        // Use requestAnimationFrame to batch connection deletions
        requestAnimationFrame(() => {
          removeChanges.forEach(change => {
            deleteConnection(selectedTreeId, change.id);
          });

          // Auto-save after connection removal
          if (autoSave && project) {
            try {
              useProjectStore.getState().saveProject();
            } catch (error) {
              console.error('Auto-save failed:', error);
            }
          }
        });
      }
    },
    [project, selectedTreeId, deleteConnection, onEdgesChange, autoSave]
  );

  // Handle node updates from properties panel
  const handleUpdateNode = useCallback(
    (updates: Partial<Block>) => {
      if (project && selectedTreeId && selectedNode) {
        updateBlock(selectedTreeId, selectedNode.id, updates);

        // Update local node state for immediate feedback
        setNodes(nodes => nodes.map(node =>
          node.id === selectedNode.id
            ? { ...node, data: { ...node.data, ...updates, label: updates.title || node.data.label } }
            : node
        ));

        // Auto-save after node update
        if (autoSave && project) {
          try {
            useProjectStore.getState().saveProject();
          } catch (error) {
            console.error('Auto-save failed:', error);
          }
        }
      }
    },
    [project, selectedTreeId, selectedNode, updateBlock, setNodes, autoSave]
  );

  // Handle drag and drop from nodes panel
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      console.log('Drop event triggered');

      if (!reactFlowWrapper.current || !reactFlowInstance || !project || !selectedTreeId) {
        console.log('Drop prerequisites not met:', {
          hasWrapper: !!reactFlowWrapper.current,
          hasInstance: !!reactFlowInstance,
          hasProject: !!project,
          hasTreeId: !!selectedTreeId
        });
        return;
      }

      const nodeName = event.dataTransfer.getData('application/reactflow');
      console.log('Node name from data transfer:', nodeName);
      if (!nodeName) return;

      // Get node category from project.nodes
      // Find the node by name (case-insensitive match)
      const nodeKey = Object.keys(project.nodes).find(
        key => project.nodes[key].name.toLowerCase() === nodeName.toLowerCase()
      );

      if (!nodeKey) {
        console.log('Could not find node key. Available nodes:', Object.keys(project.nodes));
        return;
      }

      const nodeData = project.nodes[nodeKey];
      console.log('Node data from project:', nodeData);
      if (!nodeData) return;

      // Get drop position
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      // Round positions for consistency
      const roundedPosition = {
        x: Math.round(position.x / 15) * 15, // Snap to grid
        y: Math.round(position.y / 15) * 15  // Snap to grid
      };

      console.log('Calculated position:', roundedPosition);

      // Create new block in the store
      const blockId = createBlock(selectedTreeId, nodeKey, roundedPosition);
      console.log('Created block with ID:', blockId);

      // Add the position to our cached positions
      prevNodePositionsRef.current[blockId] = {...roundedPosition};

      // Now directly update the ReactFlow nodes state for immediate feedback
      // This prevents the full tree sync which could cause jumping
      const newNode = {
        id: blockId,
        type: nodeData.category,
        position: roundedPosition,
        ...getHandlePositions(),
        data: {
          id: blockId,
          name: nodeKey,
          title: nodeData.title,
          category: nodeData.category,
          description: nodeData.description,
          properties: { ...nodeData.properties },
          label: nodeData.title || nodeData.name,
          position: roundedPosition
        },
      };

      // Add the new node to the existing nodes array
      setNodes(nodes => [...nodes, newNode]);

      // Auto-save if enabled
      if (autoSave && project) {
        try {
          requestAnimationFrame(() => {
            useProjectStore.getState().saveProject();
          });
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }
    },
    [reactFlowInstance, project, selectedTreeId, createBlock, setNodes, autoSave]
  );

  // Handle connection start for validation
  const onConnectStart: OnConnectStart = useCallback((_, { nodeId }) => {
    if (nodeId) {
      connectingNodeId.current = nodeId;
    }
  }, []);

  const onConnectEnd: OnConnectEnd = useCallback(
    (event) => {
      // Handle both mouse and touch events
      const targetElement = event instanceof MouseEvent ?
        (event.target as Element) :
        (event.touches?.[0].target as Element);

      const targetNodeId = targetElement.closest('.react-flow__node')?.getAttribute('data-id');

      if (connectingNodeId.current && targetNodeId && project && selectedTreeId) {
        // Create the connection using the store
        const connectionId = createConnection(selectedTreeId, connectingNodeId.current, targetNodeId);

        // Update the local edges state for immediate visual feedback
        if (connectionId) {
          const newEdge = {
            id: connectionId,
            source: connectingNodeId.current,
            target: targetNodeId,
            animated: true,
            type: 'default',
          };

          // Add to the local state
          setEdges(edges => [...edges, newEdge]);

          // Auto-save if enabled
          if (autoSave && project) {
            try {
              requestAnimationFrame(() => {
                useProjectStore.getState().saveProject();
              });
            } catch (error) {
              console.error('Auto-save failed:', error);
            }
          }
        }
      }

      connectingNodeId.current = null;
    },
    [project, selectedTreeId, createConnection, setEdges, autoSave]
  );

  // Get the selected block for the properties panel
  const selectedBlock = selectedNode && project && selectedTreeId
    ? project.trees[selectedTreeId].blocks[selectedNode.id]
    : undefined;

  // Mirror the store's connection rules so invalid drops are rejected visually
  const isValidConnection = useCallback(
    (connection: Connection) => {
      if (!project || !selectedTreeId || !connection.source || !connection.target) return false;
      const tree = project.trees[selectedTreeId];
      const source = tree?.blocks[connection.source];
      const target = tree?.blocks[connection.target];
      if (!source || !target) return false;
      if (connection.source === connection.target) return false;
      if (target.category === 'root') return false;
      if (source.category === 'action' || source.category === 'condition') return false;
      return true;
    },
    [project, selectedTreeId]
  );

  return (
    <EditorLayout
      canvas={
        <div className="h-full w-full" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            isValidConnection={isValidConnection}
            onNodeClick={onNodeClick}
            onNodeDragStart={onNodeDragStart}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onSelectionDragStop={onSelectionDragStop}
            onInit={setReactFlowInstance}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            maxZoom={2}
            minZoom={0.1}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            fitView
            snapToGrid={true}
            snapGrid={[15, 15]}
            nodesDraggable={true}
            elementsSelectable={true}
            selectNodesOnDrag={false}
            zoomOnDoubleClick={false}
            panOnScroll={true}
            panOnDrag={true}
            deleteKeyCode={['Backspace', 'Delete']}
            fitViewOptions={{
              padding: 0.2,
              minZoom: 0.5,
              maxZoom: 1.5
            }}
            connectionLineStyle={{ stroke: '#64748b', strokeWidth: 2 }}
            elevateNodesOnSelect={true}
            elevateEdgesOnSelect={true}
            proOptions={{ hideAttribution: true }}
            preventScrolling={true}
            nodesFocusable={true}
          >
            <Controls />
            {showGrid && <Background variant={BackgroundVariant.Dots} gap={12} size={1} />}
          </ReactFlow>
        </div>
      }
      treesPanel={<TreesPanel />}
      nodesPanel={<NodesPanel />}
      propertiesPanel={<PropertiesPanel selectedBlock={selectedBlock} onUpdateBlock={handleUpdateNode} />}
    />
  );
};

export default BehaviorTreeEditor;
