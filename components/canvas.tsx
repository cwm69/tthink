'use client';

import { updateProjectAction } from '@/app/actions/project/update';
import { prepareProjectForSaving } from '@/lib/emergency-version-cleanup';
import { useAnalytics } from '@/hooks/use-analytics';
import { useSaveProject } from '@/hooks/use-save-project';
import { useIsMobile } from '@/hooks/use-mobile';
import { handleError } from '@/lib/error/handle';
import { isValidSourceTarget } from '@/lib/xyflow';
import { MobileNotesView } from '@/components/mobile-notes-view';
import { NodeDropzoneProvider } from '@/providers/node-dropzone';
import { NodeOperationsProvider } from '@/providers/node-operations';
import { useProject } from '@/providers/project';
import {
  Background,
  type IsValidConnection,
  type OnConnect,
  type OnConnectEnd,
  type OnConnectStart,
  type OnEdgesChange,
  type OnNodesChange,
  ReactFlow,
  type ReactFlowProps,
  getOutgoers,
  useReactFlow,
  NodeResizer,
} from '@xyflow/react';
import {
  type Edge,
  type Node,
  applyEdgeChanges,
  applyNodeChanges,
} from '@xyflow/react';
import { BoxSelectIcon, PlusIcon } from 'lucide-react';
import { nanoid } from 'nanoid';
import type { MouseEvent, MouseEventHandler } from 'react';
import { useCallback, useState, useRef, useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useDebouncedCallback } from 'use-debounce';
import { addUndoEntry, performUndo, performRedo, canUndo, canRedo } from '@/lib/project-undo';
import { toast } from 'sonner';
import { ConnectionLine } from './connection-line';
import { edgeTypes } from './edges';
import { nodeTypes } from './nodes';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from './ui/context-menu';
// Removed zoom indicator import - now integrated into controls

type Project = {
  id: string;
  title: string;
  updatedAt: string;
  userId: string;
};

type CanvasProps = ReactFlowProps & {
  projects?: Project[];
};

export const Canvas = ({ children, projects, ...props }: CanvasProps) => {
  const project = useProject();
  const {
    onConnect,
    onConnectStart,
    onConnectEnd,
    onEdgesChange,
    onNodesChange,
    nodes: initialNodes,
    edges: initialEdges,
    ...rest
  } = props ?? {};
  const content = project?.content as { nodes: Node[]; edges: Edge[] };
  const [nodes, setNodes] = useState<Node[]>(
    initialNodes ?? content?.nodes ?? []
  );
  const [edges, setEdges] = useState<Edge[]>(
    initialEdges ?? content?.edges ?? []
  );
  const [copiedNodes, setCopiedNodes] = useState<Node[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const {
    getEdges,
    toObject,
    screenToFlowPosition,
    getNodes,
    getNode,
    updateNode,
  } = useReactFlow();
  const analytics = useAnalytics();
  const [saveState, setSaveState] = useSaveProject();
  const isMobile = useIsMobile();

  const save = useDebouncedCallback(async () => {
    if (saveState.isSaving || !project?.id) {
      return;
    }

    // Anonymous user - save to database (same as authenticated users)
    if (project.userId.startsWith('anon_')) {
      try {
        setSaveState((prev) => ({ ...prev, isSaving: true }));

        const response = await updateProjectAction(project.id, {
          content: prepareProjectForSaving(toObject()),
        });

        if ('error' in response) {
          throw new Error(response.error);
        }

        setSaveState((prev) => ({ ...prev, lastSaved: new Date() }));
      } catch (error) {
        handleError('Error saving project', error);
      } finally {
        setSaveState((prev) => ({ ...prev, isSaving: false }));
      }
      return;
    }

    // Authenticated user - save to database
    if (!project.userId) {
      return;
    }

    try {
      setSaveState((prev) => ({ ...prev, isSaving: true }));

      const response = await updateProjectAction(project.id, {
        content: prepareProjectForSaving(toObject()),
      });

      if ('error' in response) {
        throw new Error(response.error);
      }

      setSaveState((prev) => ({ ...prev, lastSaved: new Date() }));
    } catch (error) {
      handleError('Error saving project', error);
    } finally {
      setSaveState((prev) => ({ ...prev, isSaving: false }));
    }
  }, 1000);

  const handleNodesChange = useCallback<OnNodesChange>(
    (changes) => {
      setNodes((current) => {
        // Check for node deletions to add to undo stack
        const deletions = changes.filter(change => change.type === 'remove');
        
        if (deletions.length > 0) {
          const deletedNodes = deletions.map(deletion => 
            current.find(node => node.id === deletion.id)
          ).filter(Boolean) as Node[];
          
          const deletedEdges = getEdges().filter(edge =>
            deletions.some(deletion => 
              edge.source === deletion.id || edge.target === deletion.id
            )
          );
          
          // Add to undo stack before applying changes
          const currentContent = { nodes: current, edges: getEdges(), ...((project?.content as any) || {}) };
          const updatedContent = addUndoEntry(
            currentContent,
            deletedNodes.length > 1 ? 'bulk_operation' : 'node_deletion',
            'delete',
            {
              nodes: deletedNodes,
              edges: deletedEdges,
              affectedIds: deletions.map(d => d.id),
              description: `Delete ${deletedNodes.length > 1 ? `${deletedNodes.length} nodes` : 'node'}`,
            }
          );
          
          // Update project content with undo stack (async to avoid blocking UI)
          setTimeout(() => {
            if (project?.id) {
              updateProjectAction(project.id, { content: prepareProjectForSaving(updatedContent) });
            }
          }, 0);
        }
        
        const updated = applyNodeChanges(changes, current);
        save();
        onNodesChange?.(changes);
        return updated;
      });
    },
    [save, onNodesChange, getEdges, project]
  );

  const handleNodeMouseEnter = useCallback(
    (_: MouseEvent, node: Node) => {
      // Clear any pending deselection
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        setHoverTimeout(null);
      }
      
      setNodes((nodes) =>
        nodes.map((n) => ({
          ...n,
          selected: n.id === node.id,
        }))
      );
    },
    [hoverTimeout]
  );

  const handleNodeMouseLeave = useCallback((event: MouseEvent) => {
    // Don't deselect while dragging
    if (isDragging) return;
    
    // Clear any existing timeout
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }
    
    // Always use a small delay to allow for toolbar interaction
    const timeoutId = setTimeout(() => {
      setNodes((nodes) =>
        nodes.map((n) => ({
          ...n,
          selected: false,
        }))
      );
      setHoverTimeout(null);
    }, 150);
    
    setHoverTimeout(timeoutId);
  }, [isDragging, hoverTimeout]);

  const handleNodeDragStart = useCallback((_: MouseEvent, node: Node) => {
    setIsDragging(true);
    // Keep node selected while dragging
    setNodes((nodes) =>
      nodes.map((n) => ({
        ...n,
        selected: n.id === node.id,
      }))
    );
  }, []);

  const handleNodeDragStop = useCallback(() => {
    setIsDragging(false);
    // Deselect all nodes after drag ends
    setNodes((nodes) =>
      nodes.map((n) => ({
        ...n,
        selected: false,
      }))
    );
  }, []);

  const handleEdgesChange = useCallback<OnEdgesChange>(
    (changes) => {
      setEdges((current) => {
        const updated = applyEdgeChanges(changes, current);
        save();
        onEdgesChange?.(changes);
        return updated;
      });
    },
    [save, onEdgesChange]
  );

  const handleConnect = useCallback<OnConnect>(
    (connection) => {
      const newEdge: Edge = {
        id: nanoid(),
        type: 'animated',
        ...connection,
      };
      setEdges((eds: Edge[]) => eds.concat(newEdge));
      save();
      onConnect?.(connection);
    },
    [save, onConnect]
  );

  const addNode = useCallback(
    (type: string, options?: Record<string, unknown>) => {
      const { data: nodeData, ...rest } = options ?? {};
      const newNode: Node = {
        id: nanoid(),
        type,
        data: {
          ...(nodeData ? nodeData : {}),
        },
        position: { x: 0, y: 0 },
        origin: [0, 0.5],
        // Set explicit dimensions for text nodes to prevent auto-expansion
        ...(type === 'text' ? { 
          width: 400, 
          height: 300,
          style: { width: 400, height: 300 }
        } : {}),
        ...rest,
      };

      setNodes((nds: Node[]) => nds.concat(newNode));
      save();

      analytics.track('toolbar', 'node', 'added', {
        type,
      });

      return newNode.id;
    },
    [save, analytics]
  );

  const duplicateNode = useCallback(
    (id: string) => {
      const node = getNode(id);

      if (!node || !node.type) {
        return;
      }

      const { id: oldId, ...rest } = node;

      const newId = addNode(node.type, {
        ...rest,
        position: {
          x: node.position.x + 200,
          y: node.position.y + 200,
        },
        selected: true,
      });

      setTimeout(() => {
        updateNode(id, { selected: false });
        updateNode(newId, { selected: true });
      }, 0);
    },
    [addNode, getNode, updateNode]
  );

  const handleConnectEnd = useCallback<OnConnectEnd>(
    (event, connectionState) => {
      // when a connection is dropped on the pane it's not valid

      if (!connectionState.isValid) {
        // we need to remove the wrapper bounds, in order to get the correct position
        const { clientX, clientY } =
          'changedTouches' in event ? event.changedTouches[0] : event;

        const sourceId = connectionState.fromNode?.id;
        const isSourceHandle = connectionState.fromHandle?.type === 'source';

        if (!sourceId) {
          return;
        }

        const newNodeId = addNode('drop', {
          position: screenToFlowPosition({ x: clientX, y: clientY }),
          data: {
            isSource: !isSourceHandle,
          },
        });

        setEdges((eds: Edge[]) =>
          eds.concat({
            id: nanoid(),
            source: isSourceHandle ? sourceId : newNodeId,
            target: isSourceHandle ? newNodeId : sourceId,
            type: 'temporary',
          })
        );
      }
    },
    [addNode, screenToFlowPosition]
  );

  const isValidConnection = useCallback<IsValidConnection>(
    (connection) => {
      // we are using getNodes and getEdges helpers here
      // to make sure we create isValidConnection function only once
      const nodes = getNodes();
      const edges = getEdges();
      const target = nodes.find((node) => node.id === connection.target);

      // Prevent connecting audio nodes to anything except transcribe nodes
      if (connection.source) {
        const source = nodes.find((node) => node.id === connection.source);

        if (!source || !target) {
          return false;
        }

        const valid = isValidSourceTarget(source, target);

        if (!valid) {
          return false;
        }
      }

      // Prevent cycles
      const hasCycle = (node: Node, visited = new Set<string>()) => {
        if (visited.has(node.id)) {
          return false;
        }

        visited.add(node.id);

        for (const outgoer of getOutgoers(node, nodes, edges)) {
          if (outgoer.id === connection.source || hasCycle(outgoer, visited)) {
            return true;
          }
        }
      };

      if (!target || target.id === connection.source) {
        return false;
      }

      return !hasCycle(target);
    },
    [getNodes, getEdges]
  );

  const handleConnectStart = useCallback<OnConnectStart>(() => {
    // Delete any drop nodes when starting to drag a node
    setNodes((nds: Node[]) => nds.filter((n: Node) => n.type !== 'drop'));
    setEdges((eds: Edge[]) => eds.filter((e: Edge) => e.type !== 'temporary'));
    save();
  }, [save]);

  const addDropNode = useCallback<MouseEventHandler<HTMLDivElement>>(
    (event) => {
      if (!(event.target instanceof HTMLElement)) {
        return;
      }

      // Don't create a node if double-clicking on an existing node
      if (!event.target.classList.contains('react-flow__pane')) {
        return;
      }

      const { x, y } = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode('drop', {
        position: { x, y },
      });
    },
    [addNode, screenToFlowPosition]
  );

  const handlePaneClick = useCallback(() => {
    // Clear all selections when clicking on empty canvas
    setNodes((nodes) =>
      nodes.map((n) => ({
        ...n,
        selected: false,
      }))
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    setNodes((nodes: Node[]) =>
      nodes.map((node: Node) => ({ ...node, selected: true }))
    );
  }, []);

  const handleCopy = useCallback(() => {
    const selectedNodes = getNodes().filter((node) => node.selected);
    if (selectedNodes.length > 0) {
      setCopiedNodes(selectedNodes);
    }
  }, [getNodes]);

  const handlePaste = useCallback(() => {
    if (copiedNodes.length === 0) {
      return;
    }

    const newNodes = copiedNodes.map((node) => ({
      ...node,
      id: nanoid(),
      position: {
        x: node.position.x + 200,
        y: node.position.y + 200,
      },
      selected: true,
    }));

    // Unselect all existing nodes
    setNodes((nodes: Node[]) =>
      nodes.map((node: Node) => ({
        ...node,
        selected: false,
      }))
    );

    // Add new nodes
    setNodes((nodes: Node[]) => [...nodes, ...newNodes]);
  }, [copiedNodes]);

  const handleDuplicateAll = useCallback(() => {
    const selected = getNodes().filter((node) => node.selected);

    for (const node of selected) {
      duplicateNode(node.id);
    }
  }, [getNodes, duplicateNode]);

  const handleContextMenu = useCallback((event: MouseEvent) => {
    // Allow context menu to work normally
  }, []);

  useHotkeys('meta+a', handleSelectAll, {
    enableOnContentEditable: false,
    preventDefault: true,
  });

  useHotkeys('meta+d', handleDuplicateAll, {
    enableOnContentEditable: false,
    preventDefault: true,
  });

  useHotkeys('meta+c', handleCopy, {
    enableOnContentEditable: false,
    preventDefault: true,
  });

  useHotkeys('meta+v', handlePaste, {
    enableOnContentEditable: false,
    preventDefault: true,
  });

  // Undo/Redo hotkeys
  useHotkeys('meta+z', () => {
    const currentContent = {
      nodes: getNodes(),
      edges: getEdges(),
      ...((project?.content as any) || {}),
    };
    
    if (canUndo(currentContent)) {
      const result = performUndo(currentContent);
      if (result.success) {
        setNodes(result.content.nodes);
        setEdges(result.content.edges);
        toast.success(`Undone: ${result.description}`);
        
        // Update project with new undo/redo stacks
        if (project?.id) {
          updateProjectAction(project.id, { content: prepareProjectForSaving(result.content) });
        }
      }
    }
  }, {
    enableOnContentEditable: false,
    preventDefault: true,
  });

  useHotkeys('meta+shift+z', () => {
    const currentContent = {
      nodes: getNodes(),
      edges: getEdges(),
      ...((project?.content as any) || {}),
    };
    
    if (canRedo(currentContent)) {
      const result = performRedo(currentContent);
      if (result.success) {
        setNodes(result.content.nodes);
        setEdges(result.content.edges);
        toast.success(`Redone: ${result.description}`);
        
        // Update project with new undo/redo stacks
        if (project?.id) {
          updateProjectAction(project.id, { content: prepareProjectForSaving(result.content) });
        }
      }
    }
  }, {
    enableOnContentEditable: false,
    preventDefault: true,
  });



  // Show mobile notes view on mobile devices
  if (isMobile) {
    return (
      <NodeOperationsProvider addNode={addNode} duplicateNode={duplicateNode}>
        <div className="h-full w-full">
          <MobileNotesView 
            nodes={nodes} 
            edges={edges}
            projects={projects || []}
            currentProjectId={project?.id || ''}
          />
        </div>
      </NodeOperationsProvider>
    );
  }

  return (
    <NodeOperationsProvider addNode={addNode} duplicateNode={duplicateNode}>
      <NodeDropzoneProvider>
        <ContextMenu>
            <ContextMenuTrigger onContextMenu={handleContextMenu}>
            <ReactFlow
              deleteKeyCode={['Backspace', 'Delete']}
              nodes={nodes}
              onNodesChange={handleNodesChange}
              edges={edges}
              onEdgesChange={handleEdgesChange}
              onConnectStart={handleConnectStart}
              onConnect={handleConnect}
              onConnectEnd={handleConnectEnd}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              isValidConnection={isValidConnection}
              connectionLineComponent={ConnectionLine}
              panOnScroll
              panOnDrag={true}
              nodeDragThreshold={0}
              zoomOnDoubleClick={false}
              selectionOnDrag={true}
              nodesDraggable={true}
              nodesConnectable={true}
              nodesFocusable={true}
              panOnScrollSpeed={1}
              fitView
              fitViewOptions={{
                padding: 0.1,
                includeHiddenNodes: false,
                minZoom: 0.2, // 20% zoom minimum for fit view
                maxZoom: 2.0, // 200% zoom maximum for fit view
              }}
              defaultViewport={{ x: 0, y: 0, zoom: 1.0 }}
              onDoubleClick={addDropNode}
              onNodeMouseEnter={handleNodeMouseEnter}
              onNodeMouseLeave={handleNodeMouseLeave}
              onNodeDragStart={handleNodeDragStart}
              onNodeDragStop={handleNodeDragStop}
              onPaneClick={handlePaneClick}
              selectNodesOnDrag={false}
              minZoom={0.15}
              maxZoom={8}
              proOptions={{ hideAttribution: true }}
              {...rest}
            >
              <Background />
              {children}
            </ReactFlow>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={addDropNode}>
              <PlusIcon size={12} />
              <span>Add a new node</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={handleSelectAll}>
              <BoxSelectIcon size={12} />
              <span>Select all</span>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </NodeDropzoneProvider>
    </NodeOperationsProvider>
  );
};
