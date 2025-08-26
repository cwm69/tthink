import { cloneTutorialProjectAction } from '@/app/actions/project/clone';
import { AnonymousOnboard } from '@/app/components/anonymous-onboard';
import { currentUser } from '@/lib/auth';
import { database } from '@/lib/database';
import { env } from '@/lib/env';
import { projects } from '@/schema';
import { and, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'A visual AI playground | Tersa',
  description:
    'Tersa is an open source canvas for building AI workflows. Drag, drop connect and run nodes to build your own workflows powered by various industry-leading AI models.',
};

export const maxDuration = 300; // 5 minutes (Vercel hobby plan limit)

const Index = async () => {
  const user = await currentUser();
  const { TUTORIAL_TEMPLATE_PROJECT_ID } = env;

  // For authenticated users, check if they have an existing tutorial project
  if (user) {
    const existingTutorial = await database.query.projects.findFirst({
      where: and(eq(projects.userId, user.id), eq(projects.welcomeProject, true)),
    });

    if (existingTutorial) {
      // Redirect to their existing tutorial project to avoid SSR issues
      redirect(`/projects/${existingTutorial.id}`);
    }

    // No existing tutorial - create one if template is configured
    if (TUTORIAL_TEMPLATE_PROJECT_ID) {
      const cloneResult = await cloneTutorialProjectAction();
      
      if ('error' in cloneResult) {
        console.error('Tutorial clone failed for authenticated user:', cloneResult.error);
        redirect('/projects');
      } else {
        // Fetch the created project
        const project = await database.query.projects.findFirst({
          where: eq(projects.id, cloneResult.id),
        });

        if (project) {
          // Redirect to the created tutorial project to avoid SSR issues
          redirect(`/projects/${project.id}`);
        }
      }
    }

    // Fallback to projects page
    redirect('/projects');
  }

  // Anonymous user flow
  if (!TUTORIAL_TEMPLATE_PROJECT_ID) {
    // No template configured, redirect to projects page
    redirect('/projects');
  }

  // For anonymous users, show the onboarding component which will handle the server action
  return <AnonymousOnboard />;
};

export default Index;
