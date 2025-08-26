'use server';

import { getCurrentUserId } from '@/lib/auth';
import { database } from '@/lib/database';
import { profile } from '@/schema';
import { eq } from 'drizzle-orm';

export async function getCredits(): Promise<{ credits: number } | { error: string }> {
  try {
    const userId = await getCurrentUserId();
    
    if (!userId) {
      return { error: 'User not found' };
    }

    const userProfile = await database.query.profile.findFirst({
      where: eq(profile.id, userId),
    });
    
    if (!userProfile) {
      return { error: 'Profile not found' };
    }

    return { credits: userProfile.credits };
  } catch (error) {
    console.error('Error getting credits:', error);
    return { error: 'Failed to get credits' };
  }
}