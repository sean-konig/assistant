-- Create HNSW index for fast cosine similarity search on embeddings.vector
-- Safe to run multiple times
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'embeddings_vector_idx'
  ) THEN
    CREATE INDEX embeddings_vector_idx ON embeddings USING hnsw (vector vector_cosine_ops);
  END IF;
END $$;

