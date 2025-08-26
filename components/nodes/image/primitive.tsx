import { describeAction } from '@/app/actions/image/describe';
import { NodeLayout } from '@/components/nodes/layout';
import { DropzoneEmptyState } from '@/components/ui/kibo-ui/dropzone';
import { DropzoneContent } from '@/components/ui/kibo-ui/dropzone';
import { Dropzone } from '@/components/ui/kibo-ui/dropzone';
import { Skeleton } from '@/components/ui/skeleton';
import { handleError } from '@/lib/error/handle';
import { uploadFile } from '@/lib/upload';
import { useProject } from '@/providers/project';
import { useReactFlow } from '@xyflow/react';
import { Loader2Icon, UploadIcon } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import type { ImageNodeProps } from '.';

type ImagePrimitiveProps = ImageNodeProps & {
  title: string;
};


export const ImagePrimitive = ({
  data,
  id,
  type,
  title,
}: ImagePrimitiveProps) => {
  const { updateNodeData } = useReactFlow();
  const project = useProject();
  const [files, setFiles] = useState<File[] | undefined>();
  const [isUploading, setIsUploading] = useState(false);
  
  // Remove resize detection logic
  
  

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

      const description = await describeAction(url, project?.id);

      if ('error' in description) {
        throw new Error(description.error);
      }

      updateNodeData(id, {
        description: description.description,
      });
    } catch (error) {
      handleError('Error uploading image', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <NodeLayout id={id} data={data} type={type} title={title}>
      <div className="flex flex-col h-full w-full">
        <div className="flex-1 min-h-0 flex items-center justify-center">
          {isUploading && (
            <Skeleton
              className="flex animate-pulse items-center justify-center rounded-b-xl"
              style={{ width: '300px', height: '300px' }}
            >
              <Loader2Icon size={16} className="size-4 animate-spin text-muted-foreground" />
            </Skeleton>
          )}
          
          {!isUploading && data.content && (
            <div className="w-full h-full flex items-center justify-center min-h-[300px]">
              <Image
                src={data.content.url}
                alt="Image"
                width={data.width ?? 1000}
                height={data.height ?? 1000}
                className="max-w-full max-h-full h-auto w-auto"
                style={{ objectFit: 'contain' }}
              />
            </div>
          )}
          
          {!isUploading && !data.content && (
            <div style={{ width: '300px', height: '300px' }}>
              <Dropzone
                maxSize={1024 * 1024 * 10}
                minSize={1024}
                maxFiles={1}
                multiple={false}
                accept={{
                  'image/*': [],
                }}
                onDrop={handleDrop}
                src={files}
                onError={console.error}
                className="h-full w-full rounded-none border-none bg-transparent p-0 shadow-none hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent"
              >
                <DropzoneEmptyState className="p-4 h-full flex items-center justify-center">
                  <div className="flex flex-col items-center justify-center">
                    <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <UploadIcon size={16} />
                    </div>
                    <p className="my-2 w-full truncate font-medium text-sm">
                      upload or paste a link to analyze
                    </p>
                    <p className="w-full truncate text-muted-foreground text-xs">
                      drag and drop or click to upload
                    </p>
                  </div>
                </DropzoneEmptyState>
                <DropzoneContent />
              </Dropzone>
            </div>
          )}
        </div>

        <div className="flex-shrink-0">
          {!isUploading && data.content && data.description && (
            <div className="mt-3 rounded-lg bg-secondary p-3">
              <p className="text-sm leading-relaxed text-foreground">
                {data.description}
              </p>
            </div>
          )}
          
          {!isUploading && !data.content && (
            <div className="mt-3 border-t border-border pt-3 px-3 pb-2">
              <p className="text-center text-xs text-muted-foreground">
                ...or connect another node to generate an image
              </p>
            </div>
          )}
        </div>
      </div>
    </NodeLayout>
  );
};
