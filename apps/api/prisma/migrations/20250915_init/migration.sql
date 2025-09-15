-- Prisma migration: initial schema for assistant_api on Supabase
-- Ensure pgvector is available before creating tables that use it
CREATE EXTENSION IF NOT EXISTS vector;

-- Users
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY,
  "authUserId" TEXT UNIQUE NOT NULL,
  "email" TEXT UNIQUE NOT NULL,
  "name" TEXT,
  "role" TEXT NOT NULL DEFAULT 'USER',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Projects
CREATE TABLE IF NOT EXISTS "Project" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Project_userId_slug_key" ON "Project" ("userId", "slug");

-- Sources
CREATE TABLE IF NOT EXISTS "Source" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "config" JSONB NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "Source_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Items
CREATE TABLE IF NOT EXISTS "Item" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "projectId" TEXT,
  "sourceId" TEXT,
  "type" TEXT NOT NULL,
  "title" TEXT,
  "body" TEXT,
  "raw" JSONB,
  "occurredAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "Item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Item_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Item_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Embeddings: use pgvector type directly
CREATE TABLE IF NOT EXISTS "Embedding" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "itemId" TEXT,
  "vector" vector(768) NOT NULL,
  "dim" INTEGER NOT NULL DEFAULT 768,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "Embedding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Embedding_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Risk scores
CREATE TABLE IF NOT EXISTS "RiskScore" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "factors" JSONB NOT NULL,
  "computedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "RiskScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RiskScore_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Digests
CREATE TABLE IF NOT EXISTS "Digest" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "date" TIMESTAMP NOT NULL,
  "summary" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "Digest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Reminders
CREATE TABLE IF NOT EXISTS "Reminder" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "dueAt" TIMESTAMP NOT NULL,
  "content" TEXT NOT NULL,
  "sentAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Job runs
CREATE TABLE IF NOT EXISTS "JobRun" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "details" JSONB,
  "startedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "finishedAt" TIMESTAMP,
  CONSTRAINT "JobRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- UpdatedAt trigger function (optional convenience)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_user'
  ) THEN
    CREATE TRIGGER set_updated_at_user BEFORE UPDATE ON "User"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_project'
  ) THEN
    CREATE TRIGGER set_updated_at_project BEFORE UPDATE ON "Project"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_source'
  ) THEN
    CREATE TRIGGER set_updated_at_source BEFORE UPDATE ON "Source"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_item'
  ) THEN
    CREATE TRIGGER set_updated_at_item BEFORE UPDATE ON "Item"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
