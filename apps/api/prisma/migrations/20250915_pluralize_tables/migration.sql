-- Rename tables to lowercase plural names to match Prisma @@map
ALTER TABLE IF EXISTS "User" RENAME TO users;
ALTER TABLE IF EXISTS "Project" RENAME TO projects;
ALTER TABLE IF EXISTS "Source" RENAME TO sources;
ALTER TABLE IF EXISTS "Item" RENAME TO items;
ALTER TABLE IF EXISTS "Embedding" RENAME TO embeddings;
ALTER TABLE IF EXISTS "RiskScore" RENAME TO risk_scores;
ALTER TABLE IF EXISTS "Digest" RENAME TO digests;
ALTER TABLE IF EXISTS "Reminder" RENAME TO reminders;
ALTER TABLE IF EXISTS "JobRun" RENAME TO job_runs;
