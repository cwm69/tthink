-- Add policies for anonymous users to access their projects
-- Anonymous users are identified by session IDs that start with 'anon_'

-- Function to get current session ID from various sources
CREATE OR REPLACE FUNCTION get_current_session_id() RETURNS text AS $$
BEGIN
  -- First try authenticated user ID
  IF auth.uid() IS NOT NULL THEN
    RETURN auth.uid()::text;
  END IF;
  
  -- Fall back to session ID from request headers (set by middleware)
  BEGIN
    RETURN current_setting('request.headers', true)::json->>'x-session-id';
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view their own projects" ON "project";
DROP POLICY IF EXISTS "Users can insert their own projects" ON "project";  
DROP POLICY IF EXISTS "Users can update their own projects" ON "project";
DROP POLICY IF EXISTS "Users can delete their own projects" ON "project";

-- Create new policies that support both authenticated and anonymous users
CREATE POLICY "Users can view their own projects" ON "project"
  FOR SELECT USING (
    (auth.uid()::text = user_id) OR 
    (get_current_session_id() = user_id)
  );

CREATE POLICY "Users can insert their own projects" ON "project"
  FOR INSERT WITH CHECK (
    (auth.uid()::text = user_id) OR 
    (get_current_session_id() = user_id)
  );

CREATE POLICY "Users can update their own projects" ON "project"
  FOR UPDATE USING (
    (auth.uid()::text = user_id) OR 
    (get_current_session_id() = user_id)
  );

CREATE POLICY "Users can delete their own projects" ON "project"
  FOR DELETE USING (
    (auth.uid()::text = user_id) OR 
    (get_current_session_id() = user_id)
  );

-- Update profile policies too
DROP POLICY IF EXISTS "Users can view their own profile" ON "profile";
DROP POLICY IF EXISTS "Users can insert their own profile" ON "profile";
DROP POLICY IF EXISTS "Users can update their own profile" ON "profile";

CREATE POLICY "Users can view their own profile" ON "profile"
  FOR SELECT USING (
    (auth.uid()::text = id) OR 
    (get_current_session_id() = id)
  );

CREATE POLICY "Users can insert their own profile" ON "profile"
  FOR INSERT WITH CHECK (
    (auth.uid()::text = id) OR 
    (get_current_session_id() = id)
  );

CREATE POLICY "Users can update their own profile" ON "profile"
  FOR UPDATE USING (
    (auth.uid()::text = id) OR 
    (get_current_session_id() = id)
  );