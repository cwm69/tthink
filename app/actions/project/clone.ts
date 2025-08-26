'use server';

import { currentUser } from '@/lib/auth';
import { database, serviceRoleSupabase } from '@/lib/database';
import { env } from '@/lib/env';
import { parseError } from '@/lib/error/parse';
import { projects } from '@/schema';
import { and, eq } from 'drizzle-orm';

export const cloneTutorialProjectAction = async (sessionId?: string): Promise<
  | {
      id: string;
    }
  | {
      error: string;
    }
> => {
  try {
    const { TUTORIAL_TEMPLATE_PROJECT_ID } = env;
    console.log('Tutorial clone started with template ID:', TUTORIAL_TEMPLATE_PROJECT_ID);
    console.log('Clone action received sessionId:', sessionId);
    
    if (!TUTORIAL_TEMPLATE_PROJECT_ID) {
      throw new Error('No tutorial template configured');
    }

    // Get the template project
    const templateProject = await database.query.projects.findFirst({
      where: eq(projects.id, TUTORIAL_TEMPLATE_PROJECT_ID),
    });

    if (!templateProject) {
      throw new Error('Tutorial template not found');
    }

    const user = await currentUser();
    
    // Get userId - either authenticated user or provided session ID
    let userId: string;
    if (user) {
      userId = user.id;
    } else if (sessionId) {
      // Use provided session ID for anonymous users
      userId = sessionId;
      
      // Ensure profile exists for anonymous user
      const { ensureProfileExists } = await import('@/lib/session');
      await ensureProfileExists(sessionId);
    } else {
      // Fallback: create a session ID (this shouldn't normally happen)
      console.error('No user and no sessionId provided to clone action!');
      const { createSessionId } = await import('@/lib/session');
      userId = await createSessionId();
      console.log('Created fallback session:', userId);
    }

    // Check if user already has a tutorial project to prevent duplicates
    const existingTutorial = await database.query.projects.findFirst({
      where: and(eq(projects.userId, userId), eq(projects.welcomeProject, true)),
    });

    if (existingTutorial) {
      console.log('Tutorial project already exists for user:', userId);
      return { id: existingTutorial.id };
    }

    // Use service role to clone the template project (bypasses RLS)
    const { data: clonedProject, error: insertError } = await serviceRoleSupabase
      .from('project')
      .insert({
        name: templateProject.name,
        user_id: userId,
        transcription_model: templateProject.transcriptionModel,
        vision_model: templateProject.visionModel,
        content: templateProject.content,
        demo_project: true,
      })
      .select('id')
      .single();

    if (insertError || !clonedProject) {
      throw new Error(`Failed to clone tutorial project: ${insertError?.message}`);
    }

    return { id: clonedProject.id };
  } catch (error) {
    const message = parseError(error);
    return { error: message };
  }
};

export const cloneProjectAction = async (
  sourceProjectId: string,
  newName?: string
): Promise<
  | {
      id: string;
    }
  | {
      error: string;
    }
> => {
  try {
    // Get the source project
    const sourceProject = await database.query.projects.findFirst({
      where: eq(projects.id, sourceProjectId),
    });

    if (!sourceProject) {
      throw new Error('Source project not found');
    }

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

    // Use service role to clone the project (bypasses RLS)
    const { data: clonedProject, error: insertError } = await serviceRoleSupabase
      .from('project')
      .insert({
        name: newName || `${sourceProject.name} (Copy)`,
        user_id: userId,
        transcription_model: sourceProject.transcriptionModel,
        vision_model: sourceProject.visionModel,
        content: sourceProject.content,
        demo_project: false,
      })
      .select('id')
      .single();

    if (insertError || !clonedProject) {
      throw new Error(`Failed to clone project: ${insertError?.message}`);
    }

    return { id: clonedProject.id };
  } catch (error) {
    const message = parseError(error);
    return { error: message };
  }
};

/*
TUTORIAL TEMPLATE SETUP INSTRUCTIONS:

1. Create a master tutorial project in your account with the desired content/nodes
2. Get the project ID from the URL (e.g., /projects/abc123...)
3. Set the TUTORIAL_TEMPLATE_PROJECT_ID environment variable:
   - Add to .env.local: TUTORIAL_TEMPLATE_PROJECT_ID=abc123...
   - Or set in production environment

How it works:
- When users visit the root "/" route, they get redirected to a tutorial project
- If they don't have one, it's cloned from your template project  
- Both authenticated and anonymous users get their own copy to edit
- The template project remains unchanged for future cloning
- Users can edit their cloned tutorial without affecting others

Benefits:
- Easy to manage: just update one master template
- Users get immediate hands-on experience
- No complex tutorial UI needed - they learn by doing
- Scales automatically for all new users
*/