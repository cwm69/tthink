'use server';

import { cookies } from 'next/headers';
import { nanoid } from 'nanoid';
import { database } from '@/lib/database';
import { profile } from '@/schema';
import { eq } from 'drizzle-orm';

const SESSION_COOKIE_NAME = 'tersa_session';
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: false, // Allow HTTP in development
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 365, // 1 year
  path: '/',
};

export async function createAnonymousSessionAction(): Promise<string> {
  const cookieStore = await cookies();
  let sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  
  if (!sessionId) {
    sessionId = `anon_${nanoid()}`;
    cookieStore.set(SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);
    
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
      }
    } catch (error) {
      // Profile might already exist due to race condition, ignore duplicate key errors
      if (!(error as any)?.code?.includes('duplicate')) {
        throw error;
      }
    }
  }
  
  return sessionId;
}