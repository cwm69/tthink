import { getCurrentUserId } from '@/lib/auth';
import { database } from '@/lib/database';
import { getSessionId } from '@/lib/session';
import { projects } from '@/schema';
import { eq } from 'drizzle-orm';
import { MoreHorizontalIcon } from 'lucide-react';
import { Logo } from './logo';
import { ProjectSelector } from './project-selector';
import { ProjectSettings } from './project-settings';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Button } from './ui/button';

type TopLeftProps = {
  id: string;
};

export const TopLeft = async ({ id }: TopLeftProps) => {
  // Get either authenticated user ID or anonymous session ID
  const userId = await getCurrentUserId();
  const sessionId = await getSessionId();
  const effectiveUserId = userId || sessionId;

  if (!effectiveUserId) {
    return null;
  }

  const allProjects = await database.query.projects.findMany({
    where: eq(projects.userId, effectiveUserId),
  });

  if (!allProjects.length) {
    return null;
  }

  const currentProject = allProjects.find((project) => project.id === id);

  if (!currentProject) {
    return null;
  }

  return (
    <div className="absolute top-16 right-0 left-0 z-[50] m-4 flex items-center gap-3 sm:top-0 sm:right-auto">
      <Logo className="text-lg text-foreground/80" />
      <div className="flex items-center rounded-full border bg-card/90 p-0.5 drop-shadow-xs backdrop-blur-sm">
        <ProjectSelector
          projects={allProjects}
          currentProject={currentProject.id}
        />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full p-0 drop-shadow-xs">
            <MoreHorizontalIcon size={16} />
            <span className="sr-only">project menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={8}>
          <ProjectSettings data={currentProject} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
