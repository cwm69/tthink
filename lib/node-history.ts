/**
 * Node History System - Elegant versioning for node refinements
 */

export type HistoryEntry = {
  id: string;
  timestamp: Date;
  type: 'refinement' | 'generation' | 'manual_edit';
  data: any; // Previous state before the change
  metadata?: {
    prompt?: string;
    modelId?: string;
    userAction?: string;
  };
};

export type NodeHistoryData = {
  versions?: HistoryEntry[]; // Immutable list of all versions
  currentVersionPointer?: string; // ID of version currently being viewed (undefined = latest)
};

const MAX_HISTORY_ENTRIES = 10;

/**
 * Add a new version (never modifies existing versions)
 */
export function addVersion(
  nodeData: any,
  type: HistoryEntry['type'],
  currentContent: any,
  metadata?: HistoryEntry['metadata']
): any {
  const versions = nodeData.versions || [];
  
  const newEntry: HistoryEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    type,
    data: currentContent, // Save the current state as a version
    metadata,
  };

  // Add to versions and keep only the last MAX_HISTORY_ENTRIES
  const updatedVersions = [...versions, newEntry].slice(-MAX_HISTORY_ENTRIES);

  return {
    ...nodeData,
    versions: updatedVersions,
    currentVersionPointer: undefined, // New content is now the latest
  };
}

/**
 * Switch to viewing a specific version (just changes the pointer)
 */
export function switchToVersion(
  nodeData: any,
  versionId: string
): { nodeData: any; success: boolean; content: any } {
  const migratedData = migrateToNewFormat(nodeData);
  const versions = migratedData.versions || [];
  
  // Special case: switching to "latest"
  if (versionId === 'latest') {
    return {
      nodeData: {
        ...migratedData,
        currentVersionPointer: undefined,
      },
      success: true,
      content: getCurrentContent(migratedData), // Return current content
    };
  }
  
  const version = versions.find((v: HistoryEntry) => v.id === versionId);
  
  if (!version) {
    return { nodeData: migratedData, success: false, content: null };
  }

  return {
    nodeData: {
      ...migratedData,
      currentVersionPointer: versionId,
    },
    success: true,
    content: version.data, // Return the historical content
  };
}

/**
 * Migrate old history format to new versions format
 */
function migrateToNewFormat(nodeData: any): any {
  // If already using new format, return as-is
  if (nodeData.versions || !nodeData.history) {
    return nodeData;
  }
  
  // Migrate old format to new format
  return {
    ...nodeData,
    versions: nodeData.history || [],
    currentVersionPointer: nodeData.currentVersionId,
    // Keep old fields for backward compatibility
    history: nodeData.history,
    currentVersionId: nodeData.currentVersionId,
  };
}

/**
 * Get the content that should currently be displayed
 */
export function getCurrentContent(nodeData: any): any {
  const migratedData = migrateToNewFormat(nodeData);
  const versions = migratedData.versions || [];
  const pointer = migratedData.currentVersionPointer;
  
  if (!pointer) {
    // No pointer means show the latest content
    return migratedData.generated || {};
  }
  
  // Find the version being pointed to
  const version = versions.find((v: HistoryEntry) => v.id === pointer);
  return version?.data?.generated || migratedData.generated || {};
}

/**
 * Get the versions for display in UI
 */
export function getVersionsForDisplay(nodeData: any): Array<{
  id: string;
  timestamp: Date;
  type: string;
  description: string;
  metadata?: HistoryEntry['metadata'];
  isCurrent: boolean;
  isLatest: boolean;
}> {
  const migratedData = migrateToNewFormat(nodeData);
  const versions = migratedData.versions || [];
  const pointer = migratedData.currentVersionPointer;
  
  // Add "latest" entry for the current state
  const latestEntry = {
    id: 'latest',
    timestamp: new Date(),
    type: 'latest',
    description: 'Latest version',
    metadata: undefined,
    isCurrent: !pointer, // Current if no pointer (showing latest)
    isLatest: true,
  };
  
  // Add all historical versions (newest first)
  const versionEntries = [...versions].reverse().map((version: HistoryEntry) => ({
    id: version.id,
    timestamp: version.timestamp,
    type: version.type,
    description: getVersionDescription(version),
    metadata: version.metadata,
    isCurrent: pointer === version.id,
    isLatest: false,
  }));
  
  return [latestEntry, ...versionEntries];
}

/**
 * Generate a human-readable description for a version entry
 */
function getVersionDescription(entry: HistoryEntry): string {
  switch (entry.type) {
    case 'refinement':
      return entry.metadata?.prompt 
        ? `Refined: "${entry.metadata.prompt.substring(0, 50)}..."`
        : 'Content refined';
    
    case 'generation':
      return entry.metadata?.modelId
        ? `Generated with ${entry.metadata.modelId}`
        : 'Content generated';
    
    case 'manual_edit':
      return 'Manually edited';
    
    default:
      return 'Content changed';
  }
}

/**
 * Check if a node has versions
 */
export function hasVersions(nodeData: any): boolean {
  const migratedData = migrateToNewFormat(nodeData);
  return Array.isArray(migratedData.versions) && migratedData.versions.length > 0;
}

/**
 * Check if the node is currently showing a historical version
 */
export function isShowingHistoricalVersion(nodeData: any): boolean {
  const migratedData = migrateToNewFormat(nodeData);
  return Boolean(migratedData.currentVersionPointer);
}

/**
 * Get the count of versions for a node
 */
export function getVersionCount(nodeData: any): number {
  const migratedData = migrateToNewFormat(nodeData);
  return migratedData.versions?.length || 0;
}

// Backward compatibility exports
export const addHistoryEntry = addVersion;
export const revertToHistoryEntry = switchToVersion;
export const hasHistory = hasVersions;
export const getHistoryForDisplay = getVersionsForDisplay;
export const getHistoryCount = getVersionCount;