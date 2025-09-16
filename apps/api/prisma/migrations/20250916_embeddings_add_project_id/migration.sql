-- Add projectId to embeddings, backfill from items, add FK + index
ALTER TABLE embeddings ADD COLUMN IF NOT EXISTS "projectId" text;

-- Backfill using existing itemId links
UPDATE embeddings e
SET "projectId" = i."projectId"
FROM items i
WHERE e."itemId" = i.id AND e."projectId" IS NULL;

-- Add FK constraint if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'embeddings' AND constraint_name = 'embeddings_projectId_fkey'
  ) THEN
    ALTER TABLE embeddings
      ADD CONSTRAINT embeddings_projectId_fkey
      FOREIGN KEY ("projectId") REFERENCES projects(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Helpful index for filtering by project
CREATE INDEX IF NOT EXISTS embeddings_project_id_idx ON embeddings ("projectId");

