import { createProjectAction } from '@/app/actions/project/create';
import { currentUser } from '@/lib/auth';
import { database } from '@/lib/database';
import { env } from '@/lib/env';
import { projects } from '@/schema';
import { and, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Tersa',
  description: 'Create and share AI workflows',
};

export const maxDuration = 300; // 5 minutes (Vercel hobby plan limit)

const Projects = async () => {
  const user = await currentUser();

  if (!user) {
    return redirect('/sign-in');
  }

  const { TUTORIAL_TEMPLATE_PROJECT_ID } = env;

  console.log('Projects page debug:', {
    userId: user.id,
    templateId: TUTORIAL_TEMPLATE_PROJECT_ID,
  });

  // Skip onboarding - always go to tutorial if configured, otherwise regular projects

  // Single optimized query to find the user's most recent project
  // Prioritize tutorial projects if template is configured
  const projectQuery = TUTORIAL_TEMPLATE_PROJECT_ID 
    ? database.query.projects.findFirst({
        where: eq(projects.userId, user.id),
        orderBy: (projects, { desc }) => [
          desc(projects.welcomeProject), // Tutorial projects first
          desc(projects.createdAt)       // Then by most recent
        ],
      })
    : database.query.projects.findFirst({
        where: eq(projects.userId, user.id),
      });

  let project = await projectQuery;

  // If no projects exist, create first project or redirect to tutorial
  if (!project) {
    if (TUTORIAL_TEMPLATE_PROJECT_ID) {
      // Redirect to tutorial creation instead of creating here
      redirect('/tutorial');
    }

    const newProject = await createProjectAction('Untitled Project');

    if ('error' in newProject) {
      throw new Error(newProject.error);
    }

    const newFetchedProject = await database.query.projects.findFirst({
      where: eq(projects.id, newProject.id),
    });

    if (!newFetchedProject) {
      throw new Error('Failed to create project');
    }

    project = newFetchedProject;
  }

  redirect(`/projects/${project.id}`);
};

export default Projects;
