import { GatewayProvider } from '@/providers/gateway';
import { PostHogIdentifyProvider } from '@/providers/posthog-provider';
import { ReactFlowProvider } from '@xyflow/react';
import type { ReactNode } from 'react';

type WelcomeLayoutProps = {
  children: ReactNode;
};

const WelcomeLayout = ({ children }: WelcomeLayoutProps) => {
  return (
    <GatewayProvider>
      <PostHogIdentifyProvider>
        <ReactFlowProvider>{children}</ReactFlowProvider>
      </PostHogIdentifyProvider>
    </GatewayProvider>
  );
};

export default WelcomeLayout;