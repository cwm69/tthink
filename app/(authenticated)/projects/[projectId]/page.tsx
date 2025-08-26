import { Canvas } from '@/components/canvas';
import { ChatPanel } from '@/components/chat-panel';
import { Controls } from '@/components/controls';
import { Reasoning } from '@/components/reasoning';
import { SaveIndicator } from '@/components/save-indicator';
import { Toolbar } from '@/components/toolbar';
import { TopLeft } from '@/components/top-left';
import { TopRight } from '@/components/top-right';
import { currentUser } from '@/lib/auth';
import { database } from '@/lib/database';
import { ProjectProvider } from '@/providers/project';
import { projects } from '@/schema';
import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Tersa',
  description: 'Create and share AI workflows',
};

export const maxDuration = 800; // 13 minutes

type ProjectProps = {
  params: Promise<{
    projectId: string;
  }>;
};

const Project = async ({ params }: ProjectProps) => {
  const { projectId } = await params;
  const user = await currentUser();

  console.log('Project access attempt:', { projectId, hasUser: !!user });

  const project = await database.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  console.log('Project found:', { found: !!project, userId: project?.userId });

  if (!project) {
    console.log('Project not found, showing 404');
    notFound();
  }

  // Check access: either the user owns the project, or it's their anonymous project
  let canAccess = false;
  
  if (user) {
    // Authenticated user can only access their own projects
    canAccess = project.userId === user.id;
    console.log('Auth user access check:', { canAccess, projectUserId: project.userId, currentUserId: user.id });
  } else {
    // Anonymous user can only access their own anonymous projects
    const isAnonymousProject = project.userId.startsWith('anon_');
    console.log('Anonymous access check:', { isAnonymousProject, projectUserId: project.userId });
    
    if (isAnonymousProject) {
      try {
        const { getSessionId } = await import('@/lib/session');
        const currentSessionId = await getSessionId();
        canAccess = project.userId === currentSessionId;
        console.log('Session ID comparison:', { canAccess, projectUserId: project.userId, currentSessionId });
      } catch (error) {
        console.error('Session ID check failed:', error);
        canAccess = false;
      }
    }
  }

  if (!canAccess) {
    console.log('Access denied, showing 404');
    notFound();
  }

  console.log('Access granted, rendering project page');

  return (
    <div className="flex h-screen w-screen items-stretch overflow-hidden">
      <ChatPanel />
      <div className="relative flex-1">
        <ProjectProvider data={project}>
          <Canvas>
            <Controls />
            <Toolbar />
            <SaveIndicator />
          </Canvas>
        </ProjectProvider>
        <Suspense fallback={null}>
          <TopLeft id={projectId} />
        </Suspense>
        <Suspense fallback={null}>
          <TopRight id={projectId} />
        </Suspense>
      </div>
      <Reasoning />
    </div>
  );
};

export default Project;
