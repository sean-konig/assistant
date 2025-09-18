/*
  Warnings:

  - Changed the type of `type` on the `items` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `type` on the `sources` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('GMAIL', 'GOOGLE_CAL', 'SLACK', 'MANUAL_NOTE', 'TRAINING_MATERIAL');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('EMAIL', 'CAL_EVENT', 'NOTE', 'DOC', 'TASK');

-- DropForeignKey
ALTER TABLE "embeddings" DROP CONSTRAINT "Embedding_itemId_fkey";

-- DropIndex
DROP INDEX "embeddings_project_id_idx";

-- DropIndex
DROP INDEX "embeddings_vector_idx";

-- AlterTable
ALTER TABLE "digests" RENAME CONSTRAINT "Digest_pkey" TO "digests_pkey";
ALTER TABLE "digests"
  ALTER COLUMN "date" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "embeddings" RENAME CONSTRAINT "Embedding_pkey" TO "embeddings_pkey";
ALTER TABLE "embeddings"
  ALTER COLUMN "dim" SET DEFAULT 1536,
  ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "items" RENAME CONSTRAINT "Item_pkey" TO "items_pkey";
ALTER TABLE "items"
  DROP COLUMN "type",
  ADD COLUMN     "type" "ItemType" NOT NULL,
  ALTER COLUMN "occurredAt" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "updatedAt" DROP DEFAULT,
  ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "job_runs" RENAME CONSTRAINT "JobRun_pkey" TO "job_runs_pkey";
ALTER TABLE "job_runs"
  ALTER COLUMN "startedAt" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "finishedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "projects" RENAME CONSTRAINT "Project_pkey" TO "projects_pkey";
ALTER TABLE "projects"
  ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "updatedAt" DROP DEFAULT,
  ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "reminders" RENAME CONSTRAINT "Reminder_pkey" TO "reminders_pkey";
ALTER TABLE "reminders"
  ALTER COLUMN "dueAt" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "sentAt" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "risk_scores" RENAME CONSTRAINT "RiskScore_pkey" TO "risk_scores_pkey";
ALTER TABLE "risk_scores"
  ALTER COLUMN "computedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "sources" RENAME CONSTRAINT "Source_pkey" TO "sources_pkey";
ALTER TABLE "sources"
  DROP COLUMN "type",
  ADD COLUMN     "type" "SourceType" NOT NULL,
  ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "updatedAt" DROP DEFAULT,
  ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" RENAME CONSTRAINT "User_pkey" TO "users_pkey";
ALTER TABLE "users"
  ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "updatedAt" DROP DEFAULT,
  ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "owner" TEXT NOT NULL DEFAULT 'me',
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priorityScore" DOUBLE PRECISION,
    "priorityBucket" TEXT,
    "reason" JSONB,
    "sourceItemId" TEXT,
    "taskItemId" TEXT,
    "signals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_digests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "forDate" DATE NOT NULL,
    "summaryMd" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_digests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tasks_projectId_idx" ON "tasks"("projectId");

-- CreateIndex
CREATE INDEX "tasks_priorityBucket_idx" ON "tasks"("priorityBucket");

-- CreateIndex
CREATE UNIQUE INDEX "daily_digests_userId_projectId_forDate_key" ON "daily_digests"("userId", "projectId", "forDate");

-- RenameForeignKey
ALTER TABLE "digests" RENAME CONSTRAINT "Digest_userId_fkey" TO "digests_userId_fkey";

-- RenameForeignKey
ALTER TABLE "embeddings" RENAME CONSTRAINT "Embedding_userId_fkey" TO "embeddings_userId_fkey";

-- RenameForeignKey
ALTER TABLE "embeddings" RENAME CONSTRAINT "embeddings_projectid_fkey" TO "embeddings_projectId_fkey";

-- RenameForeignKey
ALTER TABLE "items" RENAME CONSTRAINT "Item_projectId_fkey" TO "items_projectId_fkey";

-- RenameForeignKey
ALTER TABLE "items" RENAME CONSTRAINT "Item_sourceId_fkey" TO "items_sourceId_fkey";

-- RenameForeignKey
ALTER TABLE "items" RENAME CONSTRAINT "Item_userId_fkey" TO "items_userId_fkey";

-- RenameForeignKey
ALTER TABLE "job_runs" RENAME CONSTRAINT "JobRun_userId_fkey" TO "job_runs_userId_fkey";

-- RenameForeignKey
ALTER TABLE "projects" RENAME CONSTRAINT "Project_userId_fkey" TO "projects_userId_fkey";

-- RenameForeignKey
ALTER TABLE "reminders" RENAME CONSTRAINT "Reminder_userId_fkey" TO "reminders_userId_fkey";

-- RenameForeignKey
ALTER TABLE "risk_scores" RENAME CONSTRAINT "RiskScore_projectId_fkey" TO "risk_scores_projectId_fkey";

-- RenameForeignKey
ALTER TABLE "risk_scores" RENAME CONSTRAINT "RiskScore_userId_fkey" TO "risk_scores_userId_fkey";

-- RenameForeignKey
ALTER TABLE "sources" RENAME CONSTRAINT "Source_userId_fkey" TO "sources_userId_fkey";

-- AddForeignKey
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_taskItemId_fkey" FOREIGN KEY ("taskItemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_digests" ADD CONSTRAINT "daily_digests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_digests" ADD CONSTRAINT "daily_digests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Project_userId_slug_key" RENAME TO "projects_userId_slug_key";

-- RenameIndex
ALTER INDEX "User_authUserId_key" RENAME TO "users_authUserId_key";

-- RenameIndex
ALTER INDEX "User_email_key" RENAME TO "users_email_key";
