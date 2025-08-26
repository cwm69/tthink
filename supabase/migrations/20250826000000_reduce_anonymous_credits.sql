-- Reduce credits for all users from 200 to 25
UPDATE profile SET credits = 25 WHERE credits > 25;

-- Update the default value for new profiles
ALTER TABLE profile ALTER COLUMN credits SET DEFAULT 25;