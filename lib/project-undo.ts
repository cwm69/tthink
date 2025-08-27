/**
 * Project-Level Undo System - Elegant undo/redo for structural changes
 */

import type { Node, Edge } from '@xyflow/react';

export type UndoEntry = {
  id: string;
  timestamp: Date;
  type: 'node_deletion' | 'edge_deletion' | 'bulk_operation' | 'node_creation';
  action: 'delete' | 'add' | 'modify';
  data: {
    nodes?: Node[];
    edges?: Edge[];
    affectedIds?: string[];
    description?: string;
  };
};

export type ProjectUndoData = {
  undoStack?: UndoEntry[];
  redoStack?: UndoEntry[];
};

const MAX_UNDO_ENTRIES = 20;

/**
 * Add an undo entry to the project's undo stack
 */
export function addUndoEntry(
  projectContent: any,
  type: UndoEntry['type'],
  action: UndoEntry['action'],
  data: UndoEntry['data']
): any {
  const undoStack = projectContent.undoStack || [];
  
  const newEntry: UndoEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    type,
    action,
    data,
  };

  // Add to undo stack and keep only the last MAX_UNDO_ENTRIES
  const updatedUndoStack = [newEntry, ...undoStack].slice(0, MAX_UNDO_ENTRIES);

  return {
    ...projectContent,
    undoStack: updatedUndoStack,
    // Clear redo stack when new action is performed
    redoStack: [],
  };
}

/**
 * Perform an undo operation
 */
export function performUndo(
  projectContent: { nodes: Node[]; edges: Edge[]; undoStack?: UndoEntry[]; redoStack?: UndoEntry[] }
): {
  content: { nodes: Node[]; edges: Edge[]; undoStack?: UndoEntry[]; redoStack?: UndoEntry[] };
  success: boolean;
  description?: string;
} {
  const undoStack = projectContent.undoStack || [];
  
  if (undoStack.length === 0) {
    return { content: projectContent, success: false };
  }

  const [lastEntry, ...remainingUndo] = undoStack;
  const redoStack = projectContent.redoStack || [];
  
  let newNodes = [...projectContent.nodes];
  let newEdges = [...projectContent.edges];
  
  // Create redo entry from current state
  const redoEntry: UndoEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    type: lastEntry.type,
    action: lastEntry.action === 'delete' ? 'add' : 'delete',
    data: {
      nodes: lastEntry.data.affectedIds?.map(id => 
        projectContent.nodes.find(n => n.id === id)
      ).filter((node): node is Node => node !== undefined) || [],
      edges: [],
      affectedIds: lastEntry.data.affectedIds,
      description: `Undo: ${lastEntry.data.description}`,
    },
  };

  // Perform the undo based on action type
  switch (lastEntry.action) {
    case 'delete':
      // Restore deleted nodes and edges
      if (lastEntry.data.nodes) {
        newNodes = [...newNodes, ...lastEntry.data.nodes];
      }
      if (lastEntry.data.edges) {
        newEdges = [...newEdges, ...lastEntry.data.edges];
      }
      break;
      
    case 'add':
      // Remove added nodes and edges
      if (lastEntry.data.affectedIds) {
        newNodes = newNodes.filter(n => !lastEntry.data.affectedIds?.includes(n.id));
        newEdges = newEdges.filter(e => 
          !lastEntry.data.affectedIds?.includes(e.source) && 
          !lastEntry.data.affectedIds?.includes(e.target)
        );
      }
      break;
  }

  return {
    content: {
      nodes: newNodes,
      edges: newEdges,
      undoStack: remainingUndo,
      redoStack: [redoEntry, ...redoStack].slice(0, MAX_UNDO_ENTRIES),
    },
    success: true,
    description: lastEntry.data.description,
  };
}

/**
 * Perform a redo operation
 */
export function performRedo(
  projectContent: { nodes: Node[]; edges: Edge[]; undoStack?: UndoEntry[]; redoStack?: UndoEntry[] }
): {
  content: { nodes: Node[]; edges: Edge[]; undoStack?: UndoEntry[]; redoStack?: UndoEntry[] };
  success: boolean;
  description?: string;
} {
  const redoStack = projectContent.redoStack || [];
  
  if (redoStack.length === 0) {
    return { content: projectContent, success: false };
  }

  const [lastEntry, ...remainingRedo] = redoStack;
  const undoStack = projectContent.undoStack || [];
  
  // Perform the redo (which is just an undo of the undo)
  const result = performUndo({
    ...projectContent,
    undoStack: [lastEntry],
    redoStack: [],
  });
  
  if (!result.success) {
    return { content: projectContent, success: false };
  }

  return {
    content: {
      ...result.content,
      undoStack: [lastEntry, ...undoStack].slice(0, MAX_UNDO_ENTRIES),
      redoStack: remainingRedo,
    },
    success: true,
    description: lastEntry.data.description,
  };
}

/**
 * Check if undo is available
 */
export function canUndo(projectContent: any): boolean {
  return Array.isArray(projectContent.undoStack) && projectContent.undoStack.length > 0;
}

/**
 * Check if redo is available  
 */
export function canRedo(projectContent: any): boolean {
  return Array.isArray(projectContent.redoStack) && projectContent.redoStack.length > 0;
}

/**
 * Get a description of what would be undone
 */
export function getUndoDescription(projectContent: any): string | null {
  const undoStack = projectContent.undoStack || [];
  return undoStack.length > 0 ? undoStack[0].data.description || 'Undo last action' : null;
}

/**
 * Get a description of what would be redone
 */
export function getRedoDescription(projectContent: any): string | null {
  const redoStack = projectContent.redoStack || [];
  return redoStack.length > 0 ? redoStack[0].data.description || 'Redo last action' : null;
}