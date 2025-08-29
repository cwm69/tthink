/**
 * Migration script to convert existing projects from full-state versioning to delta versioning
 * This should be run once to migrate existing data
 */

import { migrateProject, needsMigration, estimateMigrationSavings, type MigrationStats } from '@/lib/migrate-version-history';

/**
 * Migrate a project's version history to delta format
 * This clears old versions and preserves only current content
 */
export async function migrateProjectVersionHistory(projectId: string, projectData: any): Promise<{
  success: boolean;
  stats?: MigrationStats;
  error?: string;
}> {
  try {
    // Check if migration is needed
    if (!needsMigration(projectData)) {
      return {
        success: true,
        stats: {
          projectsProcessed: 1,
          nodesProcessed: 0,
          versionsCleared: 0,
          memoryFreed: 0
        }
      };
    }

    // Get savings estimate before migration
    const savingsEstimate = estimateMigrationSavings(projectData);
    console.log(`🔍 Project ${projectId} migration analysis:`, {
      currentMemoryUsage: `${(savingsEstimate.currentMemoryUsage / 1024).toFixed(1)}KB`,
      estimatedSavings: `${(savingsEstimate.estimatedSavings / 1024).toFixed(1)}KB`,
      percentSavings: `${savingsEstimate.percentSavings.toFixed(1)}%`
    });

    // Perform migration
    const { migratedProject, stats } = migrateProject(projectData);

    console.log(`✅ Project ${projectId} migrated successfully:`, {
      nodesProcessed: stats.nodesProcessed,
      versionsCleared: stats.versionsCleared,
      memoryFreed: `${(stats.memoryFreed / 1024).toFixed(1)}KB`
    });

    return {
      success: true,
      stats
      // Note: migratedProject should be saved separately
    };

  } catch (error) {
    console.error(`❌ Failed to migrate project ${projectId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Batch migrate multiple projects
 */
export async function batchMigrateProjects(projects: Array<{ id: string; data: any }>): Promise<{
  totalStats: MigrationStats;
  results: Array<{ projectId: string; success: boolean; error?: string }>;
}> {
  const totalStats: MigrationStats = {
    projectsProcessed: 0,
    nodesProcessed: 0,
    versionsCleared: 0,
    memoryFreed: 0
  };

  const results: Array<{ projectId: string; success: boolean; error?: string }> = [];

  for (const project of projects) {
    const result = await migrateProjectVersionHistory(project.id, project.data);
    
    results.push({
      projectId: project.id,
      success: result.success,
      error: result.error
    });

    if (result.success && result.stats) {
      totalStats.projectsProcessed++;
      totalStats.nodesProcessed += result.stats.nodesProcessed;
      totalStats.versionsCleared += result.stats.versionsCleared;
      totalStats.memoryFreed += result.stats.memoryFreed;
    }
  }

  console.log(`🎉 Batch migration completed:`, {
    projectsProcessed: totalStats.projectsProcessed,
    totalNodesProcessed: totalStats.nodesProcessed,
    totalVersionsCleared: totalStats.versionsCleared,
    totalMemoryFreed: `${(totalStats.memoryFreed / 1024 / 1024).toFixed(2)}MB`
  });

  return { totalStats, results };
}

/**
 * Example usage for React Flow project structure
 */
export function createMigrationExample() {
  const exampleProject = {
    nodes: [
      {
        id: 'text-1',
        type: 'text',
        data: {
          generated: { text: 'Current content...' },
          versions: [
            {
              id: 'v1',
              type: 'generation',
              timestamp: '2025-01-01T10:00:00Z',
              nodeData: { generated: { text: 'Old content 1...' } }
            },
            {
              id: 'v2',
              type: 'manual_edit',
              timestamp: '2025-01-01T11:00:00Z',
              nodeData: { generated: { text: 'Old content 2...' } }
            }
          ]
        }
      }
    ]
  };

  const { migratedProject, stats } = migrateProject(exampleProject);
  
  console.log('Example migration result:', {
    original: exampleProject.nodes[0].data.versions?.length,
    migrated: migratedProject.nodes[0].data.versions?.length,
    stats
  });

  return migratedProject;
}

// Export for use in migration scripts
export { needsMigration, estimateMigrationSavings } from '@/lib/migrate-version-history';