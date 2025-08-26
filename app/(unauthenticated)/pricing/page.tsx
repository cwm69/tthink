import { currentUser, currentUserProfile } from '@/lib/auth';
import { env } from '@/lib/env';
import type { Metadata } from 'next';
import { Hero } from './components/hero';

export const metadata: Metadata = {
  title: 'Tersa | Pricing',
  description: 'Choose a plan to get access to all features.',
};

const PricingPage = async () => {
  const user = await currentUser();

  return <Hero currentPlan={undefined} authenticated={Boolean(user)} />;
};

export default PricingPage;
