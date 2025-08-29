'use client';

import { ProjectSelector } from './project-selector';
import { Menu } from './menu';
import { Logo } from './logo';
import { projects } from '@/schema';

type MobileHeaderProps = {
  projects: (typeof projects.$inferSelect)[];
  currentProjectId: string;
};

export const MobileHeader = ({ projects, currentProjectId }: MobileHeaderProps) => {
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Logo className="text-lg text-foreground/80" />
          <div className="flex items-center rounded-full border bg-card/90 p-0.5">
            <ProjectSelector
              projects={projects}
              currentProject={currentProjectId}
            />
          </div>
        </div>
        <div className="flex items-center rounded-full border bg-card/90 p-1">
          <Menu />
        </div>
      </div>
    </div>
  );
};