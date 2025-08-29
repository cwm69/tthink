import DiffMatchPatch from 'diff-match-patch';

const dmp = new DiffMatchPatch();
// Optimize for performance with large texts
dmp.Diff_Timeout = 1.0; // 1 second timeout
dmp.Diff_EditCost = 4; // Balance between accuracy and speed

export interface DeltaVersion {
  id: string;
  type: 'generation' | 'refinement' | 'manual_edit' | 'base';
  timestamp: string;
  metadata?: {
    modelId?: string;
    prompt?: string;
    userAction?: string;
  };
  // Google Docs style: patches from previous version OR base text
  patches?: string; // Serialized diff patches (empty for base version)
  baseText?: string; // Full text (only for base version)
  textLength: number; // For UI display purposes
}

// Use any type for compatibility with existing node data structures
export type NodeDataWithDeltaHistory = any;

/**
 * Add a new version using Google Docs style delta compression
 */
export function addDeltaVersion(
  nodeData: NodeDataWithDeltaHistory,
  type: Exclude<DeltaVersion['type'], 'base'>,
  previousContent: { text: string },
  metadata?: DeltaVersion['metadata']
): NodeDataWithDeltaHistory {
  const currentText = nodeData.generated?.text || '';
  const previousText = previousContent.text || '';
  
  let versions = nodeData.versions || [];
  
  // Check if we have old format versions (they have 'data' field instead of 'patches'/'baseText')
  const hasOldFormat = versions.some((v: any) => v.data !== undefined || (v.type && !v.patches && !v.baseText));
  if (hasOldFormat) {
    console.log('🧹 Clearing old format version history and starting fresh with delta versioning');
    versions = [];
  }
  
  // If no versions exist, create base version first
  if (versions.length === 0 && previousText.trim()) {
    const baseVersion: DeltaVersion = {
      id: crypto.randomUUID(),
      type: 'base',
      timestamp: new Date().toISOString(),
      baseText: previousText,
      textLength: previousText.length
    };
    versions.push(baseVersion);
  }
  
  // Create patch from previous to current
  const patches = dmp.patch_make(previousText, currentText);
  const patchText = dmp.patch_toText(patches);
  
  // Only store version if there are actual changes
  if (patchText.trim() === '') {
    return nodeData;
  }
  
  const newVersion: DeltaVersion = {
    id: crypto.randomUUID(),
    type,
    timestamp: new Date().toISOString(),
    metadata,
    patches: patchText,
    textLength: currentText.length
  };
  
  const updatedNodeData = {
    ...nodeData,
    versions: [...versions, newVersion],
    currentVersionPointer: undefined // Clear to indicate current is latest
  };
  
  // Keep reasonable version count (base + 30 patches)
  if (updatedNodeData.versions.length > 31) {
    // Keep base + last 30 versions
    const base = updatedNodeData.versions.find((v: DeltaVersion) => v.type === 'base');
    const recent = updatedNodeData.versions.slice(-30);
    updatedNodeData.versions = base ? [base, ...recent.filter((v: DeltaVersion) => v.type !== 'base')] : recent;
  }
  
  return updatedNodeData;
}

/**
 * Switch to a specific version by reconstructing it from deltas
 */
export function switchToDeltaVersion(
  nodeData: NodeDataWithDeltaHistory,
  versionId: string
): { nodeData: NodeDataWithDeltaHistory; success: boolean } {
  
  // Store the latest text if we don't have it stored yet and we're switching away from latest
  if (!nodeData.currentVersionPointer && versionId !== 'latest') {
    // Store current text as the "latest" for future restoration
    nodeData = {
      ...nodeData,
      __latestText: nodeData.generated?.text || '' // Store latest text
    };
  }
  
  if (versionId === 'latest') {
    // Restore the latest text if we have it stored
    const latestText = nodeData.__latestText || nodeData.generated?.text || '';
    
    return {
      nodeData: {
        ...nodeData,
        generated: {
          ...nodeData.generated,
          text: latestText
        },
        currentVersionPointer: undefined,
        __latestText: undefined // Clear the stored latest text
      },
      success: true
    };
  }
  
  const version = nodeData.versions?.find((v: DeltaVersion) => v.id === versionId);
  if (!version) {
    return { nodeData, success: false };
  }
  
  try {
    // Reconstruct the text for this version
    const reconstructedText = reconstructTextFromVersion(nodeData, versionId);
    
    return {
      nodeData: {
        ...nodeData,
        generated: {
          ...nodeData.generated,
          text: reconstructedText
        },
        currentVersionPointer: versionId
      },
      success: true
    };
  } catch (error) {
    console.error('Failed to reconstruct version:', error);
    return { nodeData, success: false };
  }
}

/**
 * Reconstruct text content for a specific version using Google Docs approach
 * Start from base version and apply patches sequentially
 */
function reconstructTextFromVersion(
  nodeData: NodeDataWithDeltaHistory,
  versionId: string
): string {
  if (versionId === 'latest') {
    return nodeData.generated?.text || '';
  }
  
  const versions = nodeData.versions || [];
  const targetIndex = versions.findIndex((v: DeltaVersion) => v.id === versionId);
  
  if (targetIndex === -1) {
    throw new Error(`Version ${versionId} not found`);
  }

  // Find base version (should be first)
  const baseVersion = versions.find((v: DeltaVersion) => v.type === 'base');
  if (!baseVersion) {
    // Fallback: if no base version exists (old data), return current
    console.warn(`No base version found for reconstruction of ${versionId}`);
    return nodeData.generated?.text || '';
  }

  // Start with base text
  let reconstructedText = baseVersion.baseText || '';
  
  // Apply patches sequentially up to target version
  const patchVersions = versions.slice(1, targetIndex + 1).filter((v: DeltaVersion) => v.type !== 'base');
  
  for (const version of patchVersions) {
    if (version.patches) {
      try {
        const patches = dmp.patch_fromText(version.patches);
        const [result, results] = dmp.patch_apply(patches, reconstructedText);
        
        // Use result even if some patches failed (partial success)
        reconstructedText = result;
        
        if (!results.every(r => r === true)) {
          console.warn(`Some patches failed for version ${version.id}, using partial result`);
        }
      } catch (error) {
        console.warn(`Failed to apply patch for version ${version.id}:`, error);
        // Continue with current text - don't fail completely
      }
    }
  }
  
  return reconstructedText;
}

/**
 * Get current content (either latest or from version pointer)
 */
export function getCurrentDeltaContent(nodeData: NodeDataWithDeltaHistory): { text: string } | null {
  if (!nodeData.currentVersionPointer) {
    // Return latest content
    return nodeData.generated ? { text: nodeData.generated.text } : null;
  }
  
  try {
    const reconstructedText = reconstructTextFromVersion(nodeData, nodeData.currentVersionPointer);
    return { text: reconstructedText };
  } catch (error) {
    console.error('Failed to get current content:', error);
    // Fallback to latest
    return nodeData.generated ? { text: nodeData.generated.text } : null;
  }
}

/**
 * Check if node has version history
 */
export function hasDeltaVersions(nodeData: NodeDataWithDeltaHistory): boolean {
  const versions = nodeData.versions || [];
  
  // Check if we have valid delta versions (not old format with 'data' field)
  const hasValidVersions = versions.some((v: any) => v.data === undefined && (v.type === 'base' || (v.patches !== undefined || v.baseText !== undefined)));
  
  return hasValidVersions;
}

/**
 * Get memory usage estimation
 */
export function getMemoryStats(nodeData: NodeDataWithDeltaHistory): {
  versionsCount: number;
  totalPatchesSize: number;
  currentTextSize: number;
  estimatedSavings: number;
} {
  const versions = nodeData.versions || [];
  const currentTextSize = (nodeData.generated?.text || '').length;
  const totalPatchesSize = versions.reduce((sum: number, v: DeltaVersion) => sum + (v.patches?.length || 0), 0);
  
  // Estimate what the old system would have used
  const estimatedOldSize = versions.length * currentTextSize;
  const estimatedSavings = estimatedOldSize > 0 
    ? ((estimatedOldSize - totalPatchesSize) / estimatedOldSize) * 100 
    : 0;
  
  return {
    versionsCount: versions.length,
    totalPatchesSize,
    currentTextSize,
    estimatedSavings
  };
}

/**
 * Get formatted history for display in UI components
 */
export function getDeltaHistoryForDisplay(nodeData: NodeDataWithDeltaHistory) {
  let versions = nodeData.versions || [];
  
  // Filter out old format versions (those with 'data' field), only show valid delta versions
  versions = versions.filter((v: any) => v.data === undefined && (v.type === 'base' || v.patches !== undefined || v.baseText !== undefined));
  
  const currentVersionId = nodeData.currentVersionPointer;
  
  // Always include "latest" entry
  const entries = [{
    id: 'latest',
    type: 'latest' as const,
    timestamp: new Date(),
    description: 'Current version',
    isCurrent: !currentVersionId,
    isLatest: true,
    metadata: {} as DeltaVersion['metadata']
  }];

  // Add version entries in reverse chronological order
  versions
    .slice() // Don't mutate original
    .reverse()
    .forEach((version: DeltaVersion) => {
      entries.push({
        id: version.id,
        type: version.type as any, // Allow all version types
        timestamp: new Date(version.timestamp),
        description: getVersionDescription(version),
        isCurrent: currentVersionId === version.id,
        isLatest: false,
        metadata: version.metadata || {}
      });
    });

  return entries;
}

/**
 * Get description for a version
 */
function getVersionDescription(version: DeltaVersion): string {
  switch (version.type) {
    case 'generation':
      return version.metadata?.modelId 
        ? `Generated with ${version.metadata.modelId}` 
        : 'AI generated content';
    case 'refinement':
      return version.metadata?.prompt 
        ? `Refined: "${version.metadata.prompt.substring(0, 50)}${version.metadata.prompt.length > 50 ? '...' : ''}"`
        : 'Content refined';
    case 'manual_edit':
      return 'Manual edit';
    default:
      return 'Content updated';
  }
}

/**
 * Get current version description for display
 */
export function getCurrentDeltaVersionDescription(nodeData: NodeDataWithDeltaHistory): string {
  if (!nodeData.currentVersionPointer) {
    return 'Latest version';
  }
  
  const version = nodeData.versions?.find((v: DeltaVersion) => v.id === nodeData.currentVersionPointer);
  return version ? getVersionDescription(version) : 'Unknown version';
}

/**
 * Check if showing a historical version
 */
export function isShowingDeltaHistoricalVersion(nodeData: NodeDataWithDeltaHistory): boolean {
  return Boolean(nodeData.currentVersionPointer);
}

/**
 * Get version history count
 */
export function getDeltaHistoryCount(nodeData: NodeDataWithDeltaHistory): number {
  const versions = nodeData.versions || [];
  // Only count valid delta versions (not old format with 'data' field)
  return versions.filter((v: any) => v.data === undefined && (v.type === 'base' || v.patches !== undefined || v.baseText !== undefined)).length;
}

/**
 * Migration helper: Clear old version history and keep only current content
 */
export function migrateToDeltalVersioning(nodeData: any): NodeDataWithDeltaHistory {
  return {
    ...nodeData,
    versions: [], // Clear old versions
    currentVersionPointer: undefined, // Reset to latest
    // Keep current generated content as-is
  };
}