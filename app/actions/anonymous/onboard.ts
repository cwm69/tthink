'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { nanoid } from 'nanoid';
import { database } from '@/lib/database';
import { profile, projects } from '@/schema';
import { and, eq } from 'drizzle-orm';
import { env } from '@/lib/env';
import { cloneTutorialProjectAction } from '@/app/actions/project/clone';

const SESSION_COOKIE_NAME = 'tersa_session';
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 365, // 1 year
  path: '/',
};

export async function onboardAnonymousUserAction(): Promise<never> {
  const cookieStore = await cookies();
  let sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  
  console.log('Anonymous onboard action called:', { sessionId });
  
  // Create or get existing session
  if (!sessionId) {
    sessionId = `anon_${nanoid()}`;
    cookieStore.set(SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);
    console.log('Created new session:', sessionId);
    
    // Create profile for new anonymous session
    try {
      const existingProfile = await database.query.profile.findFirst({
        where: eq(profile.id, sessionId),
      });

      if (!existingProfile) {
        await database.insert(profile).values({
          id: sessionId,
          credits: 25,
          isAnonymous: true,
          onboardedAt: null,
        });
        console.log('Created profile for session:', sessionId);
      }
    } catch (error) {
      // Profile might already exist due to race condition, ignore duplicate key errors
      if (!(error as any)?.code?.includes('duplicate')) {
        throw error;
      }
    }
  }
  
  const { TUTORIAL_TEMPLATE_PROJECT_ID } = env;
  
  if (!TUTORIAL_TEMPLATE_PROJECT_ID) {
    // No template configured, redirect to projects page
    redirect('/projects');
  }
  
  // Check if user already has a tutorial project
  const existingTutorial = await database.query.projects.findFirst({
    where: and(eq(projects.userId, sessionId), eq(projects.welcomeProject, true)),
  });
  
  console.log('Checking for existing tutorial:', { exists: !!existingTutorial });
  
  if (existingTutorial) {
    redirect(`/projects/${existingTutorial.id}`);
  }
  
  // Create tutorial project
  const cloneResult = await cloneTutorialProjectAction(sessionId);
  
  if ('error' in cloneResult) {
    console.error('Tutorial clone failed in server action:', cloneResult.error);
    redirect('/projects');
  }
  
  // Redirect to the created tutorial project
  redirect(`/projects/${cloneResult.id}`);
}