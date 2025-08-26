-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create projects table
CREATE TABLE IF NOT EXISTS "project" (
  "id" text PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
  "name" varchar NOT NULL,
  "transcription_model" varchar NOT NULL,
  "vision_model" varchar NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp,
  "content" json,
  "user_id" varchar NOT NULL,
  "image" varchar,
  "members" text[],
  "demo_project" boolean DEFAULT false NOT NULL
);

-- Create profile table
CREATE TABLE IF NOT EXISTS "profile" (
  "id" text PRIMARY KEY NOT NULL,
  "onboarded_at" timestamp
);

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profile (id)
  VALUES (new.id);
  RETURN new;
END;
$$;

-- Trigger to automatically create profile when user signs up
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Enable Row Level Security
ALTER TABLE "project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "profile" ENABLE ROW LEVEL SECURITY;

-- Create policies for projects table
CREATE POLICY "Users can view their own projects" ON "project"
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own projects" ON "project"
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own projects" ON "project"
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own projects" ON "project"
  FOR DELETE USING (auth.uid()::text = user_id);

-- Create policies for profile table
CREATE POLICY "Users can view their own profile" ON "profile"
  FOR SELECT USING (auth.uid()::text = id);

CREATE POLICY "Users can insert their own profile" ON "profile"
  FOR INSERT WITH CHECK (auth.uid()::text = id);

CREATE POLICY "Users can update their own profile" ON "profile"
  FOR UPDATE USING (auth.uid()::text = id);