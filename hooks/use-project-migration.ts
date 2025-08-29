/**
 * Hook to automatically handle project migration to delta versioning
 */

import { useCallback, useEffect, useState } from 'react';
import { useProject } from '@/providers/project';
import { needsMigration, migrateProject, estimateMigrationSavings } from '@/lib/migrate-version-history';
import { toast } from 'sonner';

export function useProjectMigration() {
  const project = useProject();
  const [migrationStatus, setMigrationStatus] = useState<{
    isChecking: boolean;
    needsMigration: boolean;
    isRunning: boolean;
    completed: boolean;
    error?: string;
    savings?: {
      memoryFreed: number;
      versionsCleared: number;
    };
  }>({
    isChecking: true,
    needsMigration: false,
    isRunning: false,
    completed: false
  });

  // Check if current project needs migration
  useEffect(() => {
    if (!project) {
      setMigrationStatus(prev => ({ ...prev, isChecking: false, needsMigration: false }));
      return;
    }

    const projectNeedsMigration = needsMigration(project);
    
    if (projectNeedsMigration) {
      const savings = estimateMigrationSavings(project);
      console.log('📊 Project needs migration - estimated savings:', {
        memoryFreed: `${(savings.estimatedSavings / 1024).toFixed(1)}KB`,
        percentSavings: `${savings.percentSavings.toFixed(1)}%`
      });
    }

    setMigrationStatus({
      isChecking: false,
      needsMigration: projectNeedsMigration,
      isRunning: false,
      completed: false
    });
  }, [project]);

  // Auto-run migration if needed (optional - can be disabled)
  const runMigration = useCallback(async (autoRun: boolean = true) => {
    if (!project || !migrationStatus.needsMigration) return;

    setMigrationStatus(prev => ({ ...prev, isRunning: true, error: undefined }));

    try {
      // Show user what's happening
      if (autoRun) {
        toast.info('Optimizing project data...', {
          description: 'Converting to more efficient storage format'
        });
      }

      const { migratedProject, stats } = migrateProject(project);
      
      // TODO: Save the migrated project back to database
      // This would typically use your project save/update function
      // await saveProject(migratedProject);
      
      const memoryFreedKB = stats.memoryFreed / 1024;
      
      setMigrationStatus({
        isChecking: false,
        needsMigration: false,
        isRunning: false,
        completed: true,
        savings: {
          memoryFreed: stats.memoryFreed,
          versionsCleared: stats.versionsCleared
        }
      });

      if (autoRun) {
        toast.success('Project optimized successfully!', {
          description: `Cleared ${stats.versionsCleared} old versions, freed ${memoryFreedKB.toFixed(1)}KB memory`
        });
      }

      console.log('✅ Migration completed:', stats);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Migration failed';
      
      setMigrationStatus(prev => ({
        ...prev,
        isRunning: false,
        error: errorMessage
      }));

      console.error('❌ Migration failed:', error);
      
      if (autoRun) {
        toast.error('Failed to optimize project', {
          description: errorMessage
        });
      }
    }
  }, [project, migrationStatus.needsMigration]);

  // Auto-migration on load (can be disabled by passing false)
  useEffect(() => {
    if (!migrationStatus.isChecking && migrationStatus.needsMigration && !migrationStatus.completed) {
      // Auto-run migration after a short delay
      const timer = setTimeout(() => {
        runMigration(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [migrationStatus.isChecking, migrationStatus.needsMigration, migrationStatus.completed, runMigration]);

  return {
    ...migrationStatus,
    runMigration: () => runMigration(false), // Manual trigger
    
    // Utility functions
    getSavingsEstimate: useCallback(() => {
      if (!project) return null;
      return estimateMigrationSavings(project);
    }, [project])
  };
}

// Note: MigrationStatusBanner component moved to separate component file if needed