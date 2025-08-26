import { transcribeAction } from '@/app/actions/speech/transcribe';
import { NodeLayout } from '@/components/nodes/layout';
import {
  Dropzone,
  DropzoneContent,
  DropzoneEmptyState,
} from '@/components/ui/kibo-ui/dropzone';
import { Skeleton } from '@/components/ui/skeleton';
import { handleError } from '@/lib/error/handle';
import { uploadFile } from '@/lib/upload';
import { useProject } from '@/providers/project';
import { useReactFlow } from '@xyflow/react';
import { ChevronDownIcon, ChevronRightIcon, Loader2Icon, UploadIcon } from 'lucide-react';
import { useState } from 'react';
import type { AudioNodeProps } from '.';

type AudioPrimitiveProps = AudioNodeProps & {
  title: string;
};

export const AudioPrimitive = ({
  data,
  id,
  type,
  title,
}: AudioPrimitiveProps) => {
  const { updateNodeData } = useReactFlow();
  const [files, setFiles] = useState<File[] | undefined>();
  const project = useProject();
  const [isUploading, setIsUploading] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const handleDrop = async (files: File[]) => {
    if (isUploading || !project?.id) {
      return;
    }

    try {
      if (!files.length) {
        throw new Error('No file selected');
      }

      setIsUploading(true);
      setFiles(files);
      const [file] = files;

      const { url, type } = await uploadFile(file, 'files');

      updateNodeData(id, {
        content: {
          url,
          type,
        },
      });

      const response = await transcribeAction(url, project?.id);

      if ('error' in response) {
        throw new Error(response.error);
      }

      updateNodeData(id, {
        transcript: response.transcript,
      });
    } catch (error) {
      handleError('Error uploading video', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <NodeLayout id={id} data={data} type={type} title={title}>
      <div className="w-full min-w-[300px] max-w-sm">
        {isUploading && (
          <Skeleton className="flex h-[50px] w-full animate-pulse items-center justify-center">
            <Loader2Icon
              size={16}
              className="size-4 animate-spin text-muted-foreground"
            />
          </Skeleton>
        )}
        {!isUploading && data.content && (
          <div className="w-full">
            {/* biome-ignore lint/a11y/useMediaCaption: <explanation> */}
            <audio
              src={data.content.url}
              controls
              className="w-full rounded-none"
            />
            {data.transcript && (
              <div className="mt-3 border-t border-border">
                <button
                  onClick={() => setShowTranscript(!showTranscript)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-secondary/50 transition-colors"
                >
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Transcript
                  </span>
                  {showTranscript ? (
                    <ChevronDownIcon size={12} className="text-muted-foreground" />
                  ) : (
                    <ChevronRightIcon size={12} className="text-muted-foreground" />
                  )}
                </button>
                {showTranscript && (
                  <div className="px-3 pb-3">
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {data.transcript}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {!isUploading && !data.content && (
          <div className="w-full">
            <Dropzone
              maxSize={1024 * 1024 * 10}
              minSize={1024}
              maxFiles={1}
              multiple={false}
              accept={{
                'audio/*': [],
              }}
              onDrop={handleDrop}
              src={files}
              onError={console.error}
              className="rounded-none border-none bg-transparent shadow-none hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent"
            >
              <DropzoneEmptyState>
                <div className="flex flex-col items-center justify-center">
                  <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <UploadIcon size={16} />
                  </div>
                  <p className="my-2 w-full truncate font-medium text-sm">
                    upload or paste a link to transcribe
                  </p>
                  <p className="w-full truncate text-muted-foreground text-xs">
                    drag and drop or click to upload
                  </p>
                </div>
              </DropzoneEmptyState>
              <DropzoneContent />
            </Dropzone>
            <div className="mt-3 border-t border-border pt-3 px-3 pb-2">
              <p className="text-center text-xs text-muted-foreground">
                ...or connect another node to generate audio
              </p>
            </div>
          </div>
        )}
      </div>
    </NodeLayout>
  );
};
