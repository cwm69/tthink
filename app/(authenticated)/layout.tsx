import { currentUser, currentUserProfile } from '@/lib/auth';
import { env } from '@/lib/env';
import { GatewayProvider } from '@/providers/gateway';
import { PostHogIdentifyProvider } from '@/providers/posthog-provider';
import { ReactFlowProvider } from '@xyflow/react';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

type AuthenticatedLayoutProps = {
  children: ReactNode;
};

const AuthenticatedLayout = async ({ children }: AuthenticatedLayoutProps) => {
  const user = await currentUser();
  
  if (user) {
    // Authenticated user - check for profile
    const profile = await currentUserProfile();
    if (!profile) {
      redirect('/auth/login');
    }
  }
  
  // Allow anonymous users without profile checks
  return (
    <GatewayProvider>
      <PostHogIdentifyProvider>
        <ReactFlowProvider>{children}</ReactFlowProvider>
      </PostHogIdentifyProvider>
    </GatewayProvider>
  );
};

export default AuthenticatedLayout;
