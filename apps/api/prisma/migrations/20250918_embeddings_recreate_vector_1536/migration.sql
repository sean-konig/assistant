-- Ensure embeddings.vector uses vector(1536). Tries ALTER first; on failure, renames and recreates the column.
DO $$
BEGIN
  -- Drop HNSW index if present; will recreate after type change
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'embeddings_vector_idx'
  ) THEN
    DROP INDEX embeddings_vector_idx;
  END IF;

  BEGIN
    -- Attempt direct type change (works on newer pgvector)
    ALTER TABLE embeddings ALTER COLUMN vector TYPE vector(1536);
  EXCEPTION WHEN others THEN
    -- Fallback for older pgvector: rename + add new column
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'embeddings' AND column_name = 'vector'
      ) THEN
        ALTER TABLE embeddings RENAME COLUMN vector TO vector_old;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'embeddings' AND column_name = 'vector'
      ) THEN
        ALTER TABLE embeddings ADD COLUMN vector vector(1536);
      END IF;
    END;
  END;

  -- Ensure dim default aligns with 1536
  ALTER TABLE embeddings ALTER COLUMN dim SET DEFAULT 1536;

  -- Recreate HNSW index (cosine) if not present
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'embeddings_vector_idx'
  ) THEN
    CREATE INDEX embeddings_vector_idx ON embeddings USING hnsw (vector vector_cosine_ops);
  END IF;
END
$$;

