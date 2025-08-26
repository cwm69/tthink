-- Add credits and anonymous session support to profile table
ALTER TABLE profile 
  ADD COLUMN IF NOT EXISTS credits integer DEFAULT 200 NOT NULL,
  ADD COLUMN IF NOT EXISTS is_anonymous boolean DEFAULT false NOT NULL;

-- Update existing profiles to have 200 credits
UPDATE profile SET credits = 200 WHERE credits IS NULL;

-- Update the trigger function to support anonymous sessions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profile (id, credits, is_anonymous)
  VALUES (new.id, 25, false);
  RETURN new;
END;
$$;