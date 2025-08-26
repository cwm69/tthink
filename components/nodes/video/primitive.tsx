import { NodeLayout } from '@/components/nodes/layout';
import {
  Dropzone,
  DropzoneContent,
  DropzoneEmptyState,
} from '@/components/ui/kibo-ui/dropzone';
import { Skeleton } from '@/components/ui/skeleton';
import { handleError } from '@/lib/error/handle';
import { uploadFile } from '@/lib/upload';
import { useReactFlow } from '@xyflow/react';
import { Loader2Icon, UploadIcon } from 'lucide-react';
import { useState } from 'react';
import type { VideoNodeProps } from '.';

type VideoPrimitiveProps = VideoNodeProps & {
  title: string;
};

export const VideoPrimitive = ({
  data,
  id,
  type,
  title,
}: VideoPrimitiveProps) => {
  const { updateNodeData } = useReactFlow();
  const [files, setFiles] = useState<File[] | undefined>();
  const [isUploading, setIsUploading] = useState(false);

  const handleDrop = async (files: File[]) => {
    if (isUploading) {
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
    } catch (error) {
      handleError('Error uploading video', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <NodeLayout id={id} data={data} type={type} title={title}>
      {isUploading && (
        <Skeleton className="flex aspect-video w-full animate-pulse items-center justify-center">
          <Loader2Icon
            size={16}
            className="size-4 animate-spin text-muted-foreground"
          />
        </Skeleton>
      )}
      {!isUploading && data.content && (
        <>
          {data.content.type === 'video/youtube' ? (
            <iframe
              src={data.content.url}
              className="aspect-video w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="YouTube video"
            />
          ) : (
            <video
              src={data.content.url}
              className="h-auto w-full"
              autoPlay
              muted
              loop
            />
          )}
        </>
      )}
      {!isUploading && !data.content && (
        <div className="w-full">
          <Dropzone
            maxSize={1024 * 1024 * 10}
            minSize={1024}
            maxFiles={1}
            multiple={false}
            accept={{
              'video/*': [],
            }}
            onDrop={handleDrop}
            src={files}
            onError={console.error}
            className="rounded-none border-none bg-transparent shadow-none hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent"
          >
            <DropzoneEmptyState className="p-4">
              <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <UploadIcon size={16} />
              </div>
              <p className="my-2 w-full truncate font-medium text-sm">
                upload or paste a link to transcribe
              </p>
              <p className="w-full truncate text-muted-foreground text-xs">
                drag and drop or click to upload
              </p>
            </DropzoneEmptyState>
            <DropzoneContent />
          </Dropzone>
          
          
          <div className="mt-3 border-t border-border pt-3 px-3 pb-2">
            <p className="text-center text-xs text-muted-foreground">
              ...or connect another node to generate video
            </p>
          </div>
        </div>
      )}
    </NodeLayout>
  );
};
