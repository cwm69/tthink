'use server';

import { currentUser } from '@/lib/auth';
import { database } from '@/lib/database';
import { parseError } from '@/lib/error/parse';
import { projects } from '@/schema';
import { and, eq } from 'drizzle-orm';

export const deleteProjectAction = async (
  projectId: string
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

    // Get userId - either authenticated user or create session for anonymous
    let userId: string;
    if (user) {
      userId = user.id;
    } else {
      // For anonymous users, create a session ID
      const { createSessionId } = await import('@/lib/session');
      userId = await createSessionId();
    }

    const project = await database
      .delete(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

    if (!project) {
      throw new Error('Project not found');
    }

    return { success: true };
  } catch (error) {
    const message = parseError(error);

    return { error: message };
  }
};
