import { createProjectAction } from '@/app/actions/project/create';
import { currentUser } from '@/lib/auth';
import { database } from '@/lib/database';
import { ProjectProvider } from '@/providers/project';
import { projects } from '@/schema';
import { and, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { WelcomeDemo } from './components/welcome-demo';
import { SimpleWelcomeDemo } from './components/simple-welcome-demo';

const title = 'Welcome to Tersa!';
const description =
  "Tersa is a platform for creating and sharing AI-powered projects. Let's get started by creating a flow, together.";

export const metadata: Metadata = {
  title,
  description,
};

const Welcome = async () => {
  const user = await currentUser();

  if (user) {
    // Authenticated user - use or create their welcome project
    let welcomeProject = await database.query.projects.findFirst({
      where: and(eq(projects.userId, user.id), eq(projects.welcomeProject, true)),
    });

    if (!welcomeProject) {
      const response = await createProjectAction('Welcome', true);

      if ('error' in response) {
        return <div>Error: {response.error}</div>;
      }

      const project = await database.query.projects.findFirst({
        where: eq(projects.id, response.id),
      });

      welcomeProject = project;
    }

    if (!welcomeProject) {
      throw new Error('Failed to create welcome project');
    }

    return (
      <div className="flex flex-col gap-4">
        <ProjectProvider data={welcomeProject}>
          <WelcomeDemo title={title} description={description} />
        </ProjectProvider>
      </div>
    );
  }

  // Anonymous user - create welcome project and show tutorial
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('tersa_session')?.value;
    
    if (!sessionId) {
      // This shouldn't happen as middleware ensures session exists
      redirect('/api/session?redirect=/welcome');
    }
    
    // Create welcome project for this session
    const response = await createProjectAction('Welcome', true);

    if ('error' in response) {
      return <div>Error: {response.error}</div>;
    }

    const project = await database.query.projects.findFirst({
      where: eq(projects.id, response.id),
    });

    if (!project) {
      throw new Error('Failed to create welcome project');
    }

    return (
      <div className="flex flex-col gap-4">
        <ProjectProvider data={project}>
          <SimpleWelcomeDemo title={title} description={description} />
        </ProjectProvider>
      </div>
    );
  } catch (error) {
    console.error('Error creating anonymous welcome:', error);
    redirect('/auth/login');
  }
};

export default Welcome;
