'use client';

import { useEffect } from 'react';
import { onboardAnonymousUserAction } from '@/app/actions/anonymous/onboard';

export function AnonymousOnboard() {
  useEffect(() => {
    // Call the server action on mount
    onboardAnonymousUserAction();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p>Setting up your workspace...</p>
      </div>
    </div>
  );
}