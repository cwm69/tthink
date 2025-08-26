'use client';

import { ProjectProvider } from '@/providers/project';
import { useEffect, useState } from 'react';
import { SimpleWelcomeDemo } from './simple-welcome-demo';
import { useRouter } from 'next/navigation';

type AnonymousProjectProviderProps = {
  title: string;
  description: string;
};

export function AnonymousProjectProvider({ title, description }: AnonymousProjectProviderProps) {
  const [projectData, setProjectData] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Create a real anonymous project for the welcome tour
    const createWelcomeProject = async () => {
      try {
        const { createAnonymousProject } = await import('@/app/actions/project/create-anonymous');
        await createAnonymousProject();
      } catch (error) {
        console.error('Failed to create welcome project:', error);
        setLoading(false);
      }
    };

    createWelcomeProject();
  }, []);

  if (loading || !projectData) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">Welcome to Tersa</h1>
          <p className="text-muted-foreground">Setting up your canvas...</p>
        </div>
      </div>
    );
  }

  return (
    <ProjectProvider data={projectData}>
      <SimpleWelcomeDemo title={title} description={description} />
    </ProjectProvider>
  );
}