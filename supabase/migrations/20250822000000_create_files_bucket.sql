-- Create the files storage bucket (public for URLs, but access controlled by RLS)
INSERT INTO storage.buckets (id, name, public)
VALUES ('files', 'files', true);

-- Helper function to get current session ID (same as in main DB)
CREATE OR REPLACE FUNCTION get_current_session_id_storage() RETURNS text AS $$
BEGIN
  -- Try authenticated user first
  IF auth.uid() IS NOT NULL THEN
    RETURN auth.uid()::text;
  END IF;
  
  -- Fall back to anonymous session from request headers
  RETURN current_setting('request.headers', true)::json->>'x-session-id';
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow users to upload files to their own folder
CREATE POLICY "Users can upload to their own folder" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'files' AND 
  (storage.foldername(name))[1] = get_current_session_id_storage()
);

-- Allow users to view their own files
CREATE POLICY "Users can view their own files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'files' AND 
  (storage.foldername(name))[1] = get_current_session_id_storage()
);

-- Allow users to update their own files
CREATE POLICY "Users can update their own files" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'files' AND 
  (storage.foldername(name))[1] = get_current_session_id_storage()
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'files' AND 
  (storage.foldername(name))[1] = get_current_session_id_storage()
);