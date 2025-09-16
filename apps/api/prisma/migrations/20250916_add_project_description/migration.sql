-- Add optional description to projects
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS description text;

