'use client';

import { createProjectAction } from '@/app/actions/project/create';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
} from '@/components/ui/kibo-ui/combobox';
// Removed useUser import to support anonymous users
import { handleError } from '@/lib/error/handle';
import { cn } from '@/lib/utils';
import type { projects } from '@/schema';
import Fuse from 'fuse.js';
import { CheckIcon, PlusIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  type FormEventHandler,
  Fragment,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';

type ProjectSelectorProps = {
  projects: (typeof projects.$inferSelect)[];
  currentProject: string;
};

export const ProjectSelector = ({
  projects,
  currentProject,
}: ProjectSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentProject);
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const router = useRouter();
  // Don't use useUser to support anonymous users

  const fuse = useMemo(
    () =>
      new Fuse(projects, {
        keys: ['name'],
        minMatchCharLength: 1,
        threshold: 0.3,
      }),
    [projects]
  );

  const handleCreateProject = useCallback<FormEventHandler<HTMLFormElement>>(
    async (event) => {
      event.preventDefault();

      if (isCreating) {
        return;
      }

      setIsCreating(true);

      try {
        const response = await createProjectAction(name.trim());

        if ('error' in response) {
          throw new Error(response.error);
        }

        setOpen(false);
        setName('');
        router.push(`/projects/${response.id}`);
      } catch (error) {
        handleError('Error creating project', error);
      } finally {
        setIsCreating(false);
      }
    },
    [isCreating, name, router]
  );

  const handleSelect = useCallback(
    (projectId: string) => {
      if (projectId === 'new') {
        setCreateOpen(true);
        return;
      }

      setValue(projectId);
      setOpen(false);
      router.push(`/projects/${projectId}`);
    },
    [router]
  );

  const projectGroups = useMemo(() => {
    // All projects passed to this component belong to the current user
    // (either authenticated user or anonymous session)
    return [
      {
        label: 'My Projects',
        data: projects,
      },
    ];
  }, [projects]);

  const filterByFuse = useCallback(
    (currentValue: string, search: string) => {
      return fuse
        .search(search)
        .find((result) => result.item.id === currentValue)
        ? 1
        : 0;
    },
    [fuse]
  );

  return (
    <>
      <Combobox
        open={open}
        onOpenChange={setOpen}
        data={projects.map((project) => ({
          label: project.name.toLowerCase(),
          value: project.id,
        }))}
        type="project"
        value={value}
        onValueChange={handleSelect}
      >
        <ComboboxTrigger className="w-[200px] rounded-full border-none bg-transparent shadow-none" />
        <ComboboxContent
          filter={filterByFuse}
          className="p-0 z-[110]"
          popoverOptions={{
            sideOffset: 8,
            className: "z-[110]",
          }}
        >
          <ComboboxInput />
          <ComboboxList>
            <ComboboxEmpty />
            {projectGroups
              .filter((group) => group.data.length > 0)
              .map((group) => (
                <Fragment key={group.label}>
                  <ComboboxGroup heading={group.label}>
                    {group.data.map((project) => (
                      <ComboboxItem key={project.id} value={project.id}>
                        {project.name.toLowerCase()}
                        <CheckIcon
                          className={cn(
                            'ml-auto',
                            value === project.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                      </ComboboxItem>
                    ))}
                  </ComboboxGroup>
                  <ComboboxSeparator />
                </Fragment>
              ))}
            <ComboboxGroup>
              <ComboboxItem value="new">
                <PlusIcon size={16} />
                Create new project
              </ComboboxItem>
            </ComboboxGroup>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <Dialog open={createOpen} onOpenChange={setCreateOpen} modal={false}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new project</DialogTitle>
            <DialogDescription>
              What would you like to call your new project?
            </DialogDescription>
            <form
              onSubmit={handleCreateProject}
              className="mt-2 flex items-center gap-2"
              aria-disabled={isCreating}
            >
              <Input
                placeholder="my new project"
                value={name}
                onChange={({ target }) => setName(target.value)}
              />
              <Button type="submit" disabled={isCreating || !name.trim()}>
                create
              </Button>
            </form>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
};
