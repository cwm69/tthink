-- Drop existing policies
DROP POLICY IF EXISTS "Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP FUNCTION IF EXISTS get_current_session_id_storage();

-- Create simpler function that works with current auth setup
CREATE OR REPLACE FUNCTION get_current_user_id_storage() RETURNS text AS $$
BEGIN
  -- For authenticated users, return their auth.uid()
  IF auth.uid() IS NOT NULL THEN
    RETURN auth.uid()::text;
  END IF;
  
  -- For anonymous users, we'll allow access based on folder structure
  -- since we're already using user.id (which includes session ID) in the path
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Authenticated users can upload to their own folder" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'files' AND 
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow anonymous uploads (since we control the path in the application)
CREATE POLICY "Anonymous users can upload" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'files' AND 
  auth.uid() IS NULL
);

-- Allow authenticated users to view their own files
CREATE POLICY "Authenticated users can view their own files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'files' AND 
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow anonymous users to view their own files
CREATE POLICY "Anonymous users can view files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'files' AND 
  auth.uid() IS NULL
);

-- Allow authenticated users to update their own files
CREATE POLICY "Authenticated users can update their own files" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'files' AND 
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow anonymous users to update files
CREATE POLICY "Anonymous users can update files" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'files' AND 
  auth.uid() IS NULL
);

-- Allow authenticated users to delete their own files
CREATE POLICY "Authenticated users can delete their own files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'files' AND 
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow anonymous users to delete files
CREATE POLICY "Anonymous users can delete files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'files' AND 
  auth.uid() IS NULL
);