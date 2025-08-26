import { cookies } from 'next/headers';
import { nanoid } from 'nanoid';
import { database } from './database';
import { profile, projects } from '@/schema';
import { eq } from 'drizzle-orm';

const SESSION_COOKIE_NAME = 'tersa_session';
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: false, // Allow HTTP in development
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 365, // 1 year
  path: '/',
};

export async function getSessionId(): Promise<string> {
  const cookieStore = await cookies();
  let sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  
  console.log('getSessionId called:', { sessionId });
  
  if (!sessionId) {
    sessionId = `anon_${nanoid()}`;
    console.log('Generated new sessionId in getSessionId:', sessionId);
    // Note: Cookie will be set by the caller in a server action context
  }
  
  return sessionId;
}

export async function createSessionId(): Promise<string> {
  const cookieStore = await cookies();
  let sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  
  if (!sessionId) {
    sessionId = `anon_${nanoid()}`;
    cookieStore.set(SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);
    
    // Create profile for new anonymous session
    await ensureProfileExists(sessionId);
  }
  
  return sessionId;
}

export async function setSessionId(sessionId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export function isAnonymousSession(id: string): boolean {
  return id.startsWith('anon_');
}

/**
 * Ensure a profile exists for the given session/user ID
 */
export async function ensureProfileExists(id: string): Promise<void> {
  const isAnonymous = id.startsWith('anon_');
  
  try {
    const existingProfile = await database.query.profile.findFirst({
      where: eq(profile.id, id),
    });

    if (!existingProfile) {
      await database.insert(profile).values({
        id,
        credits: 25,
        isAnonymous,
        onboardedAt: isAnonymous ? null : new Date(),
      });
    }
  } catch (error) {
    // Profile might already exist due to race condition, ignore duplicate key errors
    if (!(error as any)?.code?.includes('duplicate')) {
      throw error;
    }
  }
}

/**
 * Convert anonymous session to authenticated user account
 */
export async function claimAnonymousSession(userId: string): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionId || !sessionId.startsWith('anon_')) {
    return; // No anonymous session to claim
  }

  try {
    // Transfer projects from anonymous session to authenticated user
    await database
      .update(projects)
      .set({ userId })
      .where(eq(projects.userId, sessionId));

    // Create or update the profile for the authenticated user
    await ensureProfileExists(userId);
    
    // Remove the anonymous profile
    await database
      .delete(profile)
      .where(eq(profile.id, sessionId));

    // Clear the anonymous session cookie
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch (error) {
    console.error('Error claiming anonymous session:', error);
    // Don't throw - let the user continue with their new account
  }
}