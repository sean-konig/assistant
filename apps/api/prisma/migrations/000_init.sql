-- Initial schema for assistant_api
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table mirrors Supabase auth.users minimal fields used by app
CREATE TABLE "User" (
	"id" TEXT PRIMARY KEY,
	"authUserId" TEXT UNIQUE NOT NULL,
	"email" TEXT UNIQUE NOT NULL,
	"name" TEXT,
	"role" TEXT NOT NULL DEFAULT 'USER',
	"createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
	"updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Projects
CREATE TABLE "Project" (
	"id" TEXT PRIMARY KEY,
	"userId" TEXT NOT NULL,
	"name" TEXT NOT NULL,
	"slug" TEXT NOT NULL,
	"createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
	"updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
	CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Project_userId_slug_key" ON "Project" ("userId", "slug");

-- Source types enum simulated with check constraint (Prisma will enforce via app)
CREATE TABLE "Source" (
	"id" TEXT PRIMARY KEY,
	"userId" TEXT NOT NULL,
	"type" TEXT NOT NULL,
	"label" TEXT NOT NULL,
	"config" JSONB NOT NULL,
	"createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
	"updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
	CONSTRAINT "Source_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Items and enums via text
CREATE TABLE "Item" (
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

-- Embeddings; vector column will be altered to vector(768) in 001_pgvector.sql
CREATE TABLE "Embedding" (
	"id" TEXT PRIMARY KEY,
	"userId" TEXT NOT NULL,
	"itemId" TEXT,
	"vector" BYTEA NOT NULL,
	"dim" INTEGER NOT NULL DEFAULT 768,
	"createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
	CONSTRAINT "Embedding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT "Embedding_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Risk scores
CREATE TABLE "RiskScore" (
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
CREATE TABLE "Digest" (
	"id" TEXT PRIMARY KEY,
	"userId" TEXT NOT NULL,
	"date" TIMESTAMP NOT NULL,
	"summary" TEXT NOT NULL,
	"createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
	CONSTRAINT "Digest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Reminders
CREATE TABLE "Reminder" (
	"id" TEXT PRIMARY KEY,
	"userId" TEXT NOT NULL,
	"dueAt" TIMESTAMP NOT NULL,
	"content" TEXT NOT NULL,
	"sentAt" TIMESTAMP,
	"createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
	CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Jobs
CREATE TABLE "JobRun" (
	"id" TEXT PRIMARY KEY,
	"userId" TEXT NOT NULL,
	"kind" TEXT NOT NULL,
	"status" TEXT NOT NULL,
	"details" JSONB,
	"startedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
	"finishedAt" TIMESTAMP,
	CONSTRAINT "JobRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Triggers to maintain updatedAt
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
	NEW."updatedAt" = NOW();
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_user BEFORE UPDATE ON "User"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_project BEFORE UPDATE ON "Project"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_source BEFORE UPDATE ON "Source"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_item BEFORE UPDATE ON "Item"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
