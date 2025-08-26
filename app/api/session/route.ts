import { cookies } from 'next/headers';
import { nanoid } from 'nanoid';
import { database } from '@/lib/database';
import { profile } from '@/schema';
import { eq } from 'drizzle-orm';
import { NextResponse, NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'tersa_session';
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: false, // Allow HTTP in development
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 365, // 1 year
  path: '/',
};

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  let sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const redirectTo = request.nextUrl.searchParams.get('redirect');
  
  console.log('API session route called:', { sessionId, redirectTo });
  
  if (!sessionId) {
    sessionId = `anon_${nanoid()}`;
    console.log('Created new session in API route:', sessionId);
    
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
  
  // If redirecting to root and we're handling tutorial flow, handle it here
  if (redirectTo === '/') {
    const { env } = await import('@/lib/env');
    const { TUTORIAL_TEMPLATE_PROJECT_ID } = env;
    
    if (TUTORIAL_TEMPLATE_PROJECT_ID) {
      const { database } = await import('@/lib/database');
      const { projects } = await import('@/schema');
      const { and, eq } = await import('drizzle-orm');
      
      // Check if user already has a tutorial project
      const existingTutorial = await database.query.projects.findFirst({
        where: and(eq(projects.userId, sessionId), eq(projects.welcomeProject, true)),
      });
      
      console.log('Checking for existing tutorial:', { exists: !!existingTutorial });
      
      if (existingTutorial) {
        const response = NextResponse.redirect(new URL(`/projects/${existingTutorial.id}`, request.url));
        response.cookies.set(SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);
        return response;
      }
      
      // Create tutorial project
      const { cloneTutorialProjectAction } = await import('@/app/actions/project/clone');
      const cloneResult = await cloneTutorialProjectAction(sessionId);
      
      if ('error' in cloneResult) {
        console.error('Tutorial clone failed in API route:', cloneResult.error);
        const response = NextResponse.redirect(new URL('/projects', request.url));
        response.cookies.set(SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);
        return response;
      }
      
      // Redirect to the created tutorial project
      const response = NextResponse.redirect(new URL(`/projects/${cloneResult.id}`, request.url));
      response.cookies.set(SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);
      return response;
    }
  }
  
  if (redirectTo) {
    const response = NextResponse.redirect(new URL(redirectTo, request.url));
    response.cookies.set(SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);
    return response;
  }
  
  const response = NextResponse.json({ sessionId });
  response.cookies.set(SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);
  
  return response;
}