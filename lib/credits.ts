'use server';

import { deductCredits } from '@/app/actions/credits/deduct';

const creditValue = 0.005; // 1 credit = $0.005 (from original implementation)

export const trackCreditUsage = async ({
  action,
  cost,
}: {
  action: string;
  cost: number;
}) => {
  const credits = Math.ceil(cost / creditValue);

  if (credits > 0) {
    const result = await deductCredits(credits);
    if (!result.success) {
      throw new Error(result.error || 'Insufficient credits');
    }
  }
};