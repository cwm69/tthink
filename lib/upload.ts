import { nanoid } from 'nanoid';
import { createClient } from './supabase/client';

export const uploadFile = async (
  file: File,
  bucket: 'avatars' | 'files' | 'screenshots',
  filename?: string
) => {
  const client = createClient();
  const { data } = await client.auth.getUser();
  const extension = file.name.split('.').pop();

  const name = filename ?? `${nanoid()}.${extension}`;
  
  // For anonymous users, use a random folder path instead of user ID
  const folderPath = data?.user ? data.user.id : `anonymous/${nanoid()}`;

  const blob = await client.storage
    .from(bucket)
    .upload(`${folderPath}/${name}`, file, {
      contentType: file.type,
      upsert: bucket === 'screenshots',
    });

  if (blob.error) {
    throw new Error(blob.error.message);
  }

  const { data: downloadUrl } = client.storage
    .from(bucket)
    .getPublicUrl(blob.data.path);

  return {
    url: downloadUrl.publicUrl,
    type: file.type,
  };
};
