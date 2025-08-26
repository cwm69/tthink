'use client';

import { deleteProjectAction } from '@/app/actions/project/delete';
import { updateProjectAction } from '@/app/actions/project/update';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { handleError } from '@/lib/error/handle';
import { transcriptionModels } from '@/lib/models/transcription';
import { visionModels } from '@/lib/models/vision';
import type { projects } from '@/schema';
import { SettingsIcon, TrashIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEventHandler, useState } from 'react';
import { toast } from 'sonner';
import { ModelSelector } from './nodes/model-selector';
import { Button } from './ui/button';
import { DropdownMenuItem } from './ui/dropdown-menu';
import { Input } from './ui/input';
import { Label } from './ui/label';

type ProjectSettingsProps = {
  data: typeof projects.$inferSelect;
};

export const ProjectSettings = ({ data }: ProjectSettingsProps) => {
  const [open, setOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [name, setName] = useState(data.name);
  const [transcriptionModel, setTranscriptionModel] = useState(
    data.transcriptionModel
  );
  const [visionModel, setVisionModel] = useState(data.visionModel);
  const router = useRouter();

  const handleUpdateProject: FormEventHandler<HTMLFormElement> = async (
    event
  ) => {
    event.preventDefault();

    if (isUpdating) {
      return;
    }

    try {
      setIsUpdating(true);

      const response = await updateProjectAction(data.id, {
        name,
        transcriptionModel,
        visionModel,
      });

      if ('error' in response) {
        throw new Error(response.error);
      }

      toast.success('project updated successfully');
      setOpen(false);
      router.refresh();
    } catch (error) {
      handleError('error updating project', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteProject = async () => {
    try {
      const response = await deleteProjectAction(data.id);

      if ('error' in response) {
        throw new Error(response.error);
      }

      toast.success('project deleted successfully');
      setOpen(false);
      router.push('/');
    } catch (error) {
      handleError('error deleting project', error);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <SettingsIcon size={16} />
          project settings
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>project settings</DialogTitle>
          <DialogDescription>update your project's details.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleUpdateProject}
          className="mt-2 grid gap-4"
          aria-disabled={isUpdating}
        >
          <div className="grid gap-2">
            <Label htmlFor="name">name</Label>
            <Input
              id="name"
              placeholder="my new project"
              value={name}
              onChange={({ target }) => setName(target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="transcriptionModel">transcription model</Label>
            <ModelSelector
              id="transcriptionModel"
              value={transcriptionModel}
              options={transcriptionModels}
              width={462}
              onChange={setTranscriptionModel}
              disabled={false}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="visionModel">vision model</Label>
            <ModelSelector
              id="visionModel"
              value={visionModel}
              options={visionModels}
              onChange={setVisionModel}
              width={462}
              disabled={false}
            />
          </div>
          <Button type="submit" disabled={isUpdating || !name.trim()}>
            update
          </Button>
        </form>
        <DialogFooter className="-mx-6 mt-4 border-t px-6 pt-4 sm:justify-center">
          <Button
            variant="link"
            onClick={handleDeleteProject}
            className="flex items-center gap-2 text-destructive"
          >
            <TrashIcon size={16} />
            <span>delete</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
