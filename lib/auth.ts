import { profile } from '@/schema';
import { eq } from 'drizzle-orm';
import { database } from './database';
import { createClient } from './supabase/server';

export const currentUser = async () => {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  return user;
};

export const getCurrentUserId = async (): Promise<string | null> => {
  const user = await currentUser();
  if (user) {
    return user.id;
  }
  
  // For anonymous users, get session ID from existing session system
  try {
    const { getSessionId } = await import('./session');
    return await getSessionId();
  } catch {
    return null;
  }
};

export const currentUserProfile = async () => {
  const userId = await getCurrentUserId();
  
  if (!userId) {
    return null; // No user session
  }

  const userProfiles = await database
    .select()
    .from(profile)
    .where(eq(profile.id, userId));
  let userProfile = userProfiles.at(0);

  if (!userProfile) {
    try {
      const response = await database
        .insert(profile)
        .values({ 
          id: userId,
          credits: 200 // All users start with 200 credits
        })
        .returning();

      if (response.length) {
        userProfile = response[0];
      }
    } catch (error: any) {
      // Handle unique constraint violation (profile already exists)
      if (error?.code === '23505') {
        // Re-fetch the profile that was created by another request
        const userProfiles = await database
          .select()
          .from(profile)
          .where(eq(profile.id, userId));
        userProfile = userProfiles.at(0);
      } else {
        throw error;
      }
    }
  }

  return userProfile;
};

export const getSubscribedUser = async () => {
  // For now, allow both authenticated and anonymous users
  // We'll check credits instead of subscription status
  const profile = await currentUserProfile();
  
  if (!profile) {
    throw new Error('Unable to create user session.');
  }

  if (profile.credits <= 0) {
    throw new Error('No credits remaining. Please sign up for more credits.');
  }

  return profile;
};
