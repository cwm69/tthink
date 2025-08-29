/**
 * Migration utility to convert existing projects to delta-based versioning
 * This will clear old version history and keep only the latest content
 */

import { migrateToDeltalVersioning } from './node-history-delta';

export interface MigrationStats {
  projectsProcessed: number;
  nodesProcessed: number;
  versionsCleared: number;
  memoryFreed: number; // Estimated bytes freed
}

/**
 * Migrate a single node to delta versioning
 */
export function migrateNode(nodeData: any): { migratedNode: any; stats: { versionsCleared: number; memoryFreed: number } } {
  const oldVersions = nodeData.versions || [];
  const oldVersionsCount = oldVersions.length;
  
  // Estimate memory freed (rough calculation)
  const estimatedMemoryFreed = oldVersions.reduce((total: number, version: any) => {
    // Estimate size of version data
    const versionSize = JSON.stringify(version).length;
    return total + versionSize;
  }, 0);
  
  const migratedNode = migrateToDeltalVersioning(nodeData);
  
  return {
    migratedNode,
    stats: {
      versionsCleared: oldVersionsCount,
      memoryFreed: estimatedMemoryFreed
    }
  };
}

/**
 * Migrate all nodes in a project data structure
 */
export function migrateProject(projectData: any): { migratedProject: any; stats: MigrationStats } {
  let totalStats: MigrationStats = {
    projectsProcessed: 1,
    nodesProcessed: 0,
    versionsCleared: 0,
    memoryFreed: 0
  };
  
  // Handle different project data structures
  if (projectData.nodes && Array.isArray(projectData.nodes)) {
    // React Flow format
    const migratedNodes = projectData.nodes.map((node: any) => {
      if (node.data && (node.data.versions || node.data.generated)) {
        const { migratedNode, stats } = migrateNode(node.data);
        totalStats.nodesProcessed++;
        totalStats.versionsCleared += stats.versionsCleared;
        totalStats.memoryFreed += stats.memoryFreed;
        
        return {
          ...node,
          data: migratedNode
        };
      }
      return node;
    });
    
    return {
      migratedProject: {
        ...projectData,
        nodes: migratedNodes,
        // Add migration marker
        __migration: {
          deltaVersioningEnabled: true,
          migratedAt: new Date().toISOString(),
          stats: totalStats
        }
      },
      stats: totalStats
    };
  }
  
  // If it's a different format, return as-is
  return {
    migratedProject: {
      ...projectData,
      __migration: {
        deltaVersioningEnabled: true,
        migratedAt: new Date().toISOString(),
        noMigrationNeeded: true
      }
    },
    stats: totalStats
  };
}

/**
 * Check if project needs migration
 */
export function needsMigration(projectData: any): boolean {
  // Already migrated
  if (projectData.__migration?.deltaVersioningEnabled) {
    return false;
  }
  
  // Check if any nodes have old-style versions
  if (projectData.nodes && Array.isArray(projectData.nodes)) {
    return projectData.nodes.some((node: any) => 
      node.data?.versions && Array.isArray(node.data.versions) && node.data.versions.length > 0
    );
  }
  
  return false;
}

/**
 * Estimate memory savings from migration
 */
export function estimateMigrationSavings(projectData: any): {
  currentMemoryUsage: number;
  postMigrationUsage: number;
  estimatedSavings: number;
  percentSavings: number;
} {
  let currentUsage = 0;
  let nodesWithVersions = 0;
  
  if (projectData.nodes && Array.isArray(projectData.nodes)) {
    projectData.nodes.forEach((node: any) => {
      if (node.data?.versions && Array.isArray(node.data.versions)) {
        const nodeSize = JSON.stringify(node.data.versions).length;
        currentUsage += nodeSize;
        nodesWithVersions++;
      }
    });
  }
  
  // Post-migration: only current content remains
  const postMigrationUsage = 0; // Versions are cleared
  const savings = currentUsage - postMigrationUsage;
  const percentSavings = currentUsage > 0 ? (savings / currentUsage) * 100 : 0;
  
  return {
    currentMemoryUsage: currentUsage,
    postMigrationUsage,
    estimatedSavings: savings,
    percentSavings
  };
}