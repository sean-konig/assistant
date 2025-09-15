-- Enable pgvector and alter Embedding.vector to VECTOR(768)
CREATE EXTENSION IF NOT EXISTS vector;

-- If Embedding already exists with BYTEA, convert to VECTOR(768)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Embedding' AND column_name = 'vector'
  ) THEN
    ALTER TABLE "Embedding" ALTER COLUMN "vector" TYPE vector(768) USING decode(encode("vector", 'hex'), 'hex');
  END IF;
END $$;

