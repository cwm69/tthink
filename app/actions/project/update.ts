'use server';

import { currentUser } from '@/lib/auth';
import { database } from '@/lib/database';
import { parseError } from '@/lib/error/parse';
import { projects } from '@/schema';
import { and, eq } from 'drizzle-orm';
import { prepareProjectForSaving } from '@/lib/emergency-version-cleanup';

export const updateProjectAction = async (
  projectId: string,
  data: Partial<typeof projects.$inferInsert>
): Promise<
  | {
      success: true;
    }
  | {
      error: string;
    }
> => {
  try {
    const user = await currentUser();

    // Get the project to check ownership
    const existingProject = await database.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!existingProject) {
      throw new Error('Project not found');
    }

    // Check access: either user owns it, or it's an anonymous project being accessed anonymously
    const isAnonymousProject = existingProject.userId.startsWith('anon_');
    const canUpdate = 
      (user && existingProject.userId === user.id) || // User owns project
      (!user && isAnonymousProject); // Anonymous access to anonymous project

    if (!canUpdate) {
      throw new Error('You do not have permission to update this project!');
    }

    // Clean version history if content is being updated and it's too large
    const updateData = { ...data };
    if (updateData.content) {
      updateData.content = prepareProjectForSaving(updateData.content);
    }

    const project = await database
      .update(projects)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    if (!project) {
      throw new Error('Project not found');
    }

    return { success: true };
  } catch (error) {
    const message = parseError(error);

    return { error: message };
  }
};
