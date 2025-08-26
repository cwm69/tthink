'use server';

import { getCurrentUserId } from '@/lib/auth';
import { database } from '@/lib/database';
import { profile } from '@/schema';
import { eq, sql } from 'drizzle-orm';

export async function deductCredits(amount: number): Promise<{ success: boolean; remainingCredits: number; error?: string }> {
  try {
    const userId = await getCurrentUserId();
    
    // Atomically deduct credits and return new balance
    const result = await database
      .update(profile)
      .set({
        credits: sql`${profile.credits} - ${amount}`
      })
      .where(eq(profile.id, userId))
      .returning();

    if (!result.length) {
      return { success: false, remainingCredits: 0, error: 'Profile not found' };
    }

    const newCredits = result[0].credits;

    if (newCredits < 0) {
      // Rollback the deduction if credits went negative
      await database
        .update(profile)
        .set({
          credits: 0
        })
        .where(eq(profile.id, userId));

      return { success: false, remainingCredits: 0, error: 'Insufficient credits' };
    }

    return { success: true, remainingCredits: newCredits };
  } catch (error) {
    console.error('Error deducting credits:', error);
    return { success: false, remainingCredits: 0, error: 'Failed to deduct credits' };
  }
}