import { Toaster } from '@/components/ui/sonner';
import './globals.css';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DisableZoom } from '@/components/disable-zoom';
import { mono, sans, serif } from '@/lib/fonts';
import { cn } from '@/lib/utils';
import { PostHogProvider } from '@/providers/posthog-provider';
import { ThemeProvider } from '@/providers/theme';
import { Analytics } from '@vercel/analytics/next';
import type { ReactNode } from 'react';
import type { Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

type RootLayoutProps = {
  children: ReactNode;
};

const RootLayout = ({ children }: RootLayoutProps) => (
  <html lang="en" suppressHydrationWarning>
    <body
      className={cn(
        sans.variable,
        serif.variable,
        mono.variable,
        'bg-background text-foreground antialiased'
      )}
    >
      <PostHogProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <DisableZoom />
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster className="z-[99999999]" position="top-center" />
        </ThemeProvider>
        <Analytics />
      </PostHogProvider>
    </body>
  </html>
);

export default RootLayout;
