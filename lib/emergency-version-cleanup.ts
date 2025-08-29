/**
 * Emergency cleanup to remove old version history from nodes
 * This is a temporary solution to fix the 5MB body limit issue
 */

/**
 * Clean all version history from a project's nodes
 */
export function emergencyCleanVersions(projectData: any): any {
  if (!projectData || !projectData.nodes) {
    return projectData;
  }

  const cleanedNodes = projectData.nodes.map((node: any) => {
    if (node.data && node.data.versions) {
      const versionsCleared = node.data.versions.length;
      const memoryFreed = JSON.stringify(node.data.versions).length;
      
      console.log(`🧹 Clearing ${versionsCleared} versions from node ${node.id}, freeing ~${(memoryFreed/1024).toFixed(1)}KB`);
      
      return {
        ...node,
        data: {
          ...node.data,
          versions: [], // Clear all versions
          currentVersionPointer: undefined, // Reset to latest
          // Keep all other data intact
        }
      };
    }
    return node;
  });

  return {
    ...projectData,
    nodes: cleanedNodes,
    __versionCleanup: {
      cleanedAt: new Date().toISOString(),
      reason: 'Emergency cleanup - 5MB body limit exceeded'
    }
  };
}

/**
 * Check if project has large version history
 */
export function hasLargeVersionHistory(projectData: any): {
  hasLarge: boolean;
  totalVersions: number;
  estimatedSize: number;
} {
  if (!projectData?.nodes) {
    return { hasLarge: false, totalVersions: 0, estimatedSize: 0 };
  }

  let totalVersions = 0;
  let estimatedSize = 0;

  projectData.nodes.forEach((node: any) => {
    if (node.data?.versions) {
      totalVersions += node.data.versions.length;
      estimatedSize += JSON.stringify(node.data.versions).length;
    }
  });

  return {
    hasLarge: estimatedSize > 500 * 1024, // 500KB threshold (more aggressive)
    totalVersions,
    estimatedSize
  };
}

/**
 * Safe project data preparation for saving
 */
export function prepareProjectForSaving(projectData: any): any {
  const sizeCheck = hasLargeVersionHistory(projectData);
  
  // More aggressive cleanup - clean if >500KB instead of 1MB
  if (sizeCheck.estimatedSize > 500 * 1024) {
    console.warn(`⚠️ Large version history detected: ${sizeCheck.totalVersions} versions, ~${(sizeCheck.estimatedSize/1024/1024).toFixed(2)}MB`);
    console.log('🧹 Automatically cleaning versions to prevent save errors...');
    
    const cleaned = emergencyCleanVersions(projectData);
    
    // Verify cleanup worked
    const afterSize = JSON.stringify(cleaned).length;
    console.log(`✅ Cleanup complete. Size reduced from ${(sizeCheck.estimatedSize/1024).toFixed(1)}KB to ${(afterSize/1024).toFixed(1)}KB`);
    
    return cleaned;
  }

  return projectData;
}