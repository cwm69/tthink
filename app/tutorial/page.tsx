import { cloneTutorialProjectAction } from '@/app/actions/project/clone';
import { currentUser } from '@/lib/auth';
import { database } from '@/lib/database';
import { projects } from '@/schema';
import { and, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Tutorial | Tersa',
  description: 'Get started with Tersa',
};

export const maxDuration = 300; // 5 minutes (Vercel hobby plan limit)

const Tutorial = async () => {
  const user = await currentUser();

  if (user) {
    // Authenticated user - check for existing tutorial project first
    const existingTutorial = await database.query.projects.findFirst({
      where: and(eq(projects.userId, user.id), eq(projects.welcomeProject, true)),
    });

    if (existingTutorial) {
      redirect(`/projects/${existingTutorial.id}`);
    }
  }

  // Clone tutorial (works for both authenticated and anonymous users)
  const cloneResult = await cloneTutorialProjectAction();
  
  if ('error' in cloneResult) {
    console.error('Tutorial clone failed:', cloneResult.error);
    redirect('/welcome');
  }

  redirect(`/projects/${cloneResult.id}`);
};

export default Tutorial;