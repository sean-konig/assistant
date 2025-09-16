-- Update embeddings vector dimension to match OpenAI 1536-dim models
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'embeddings' AND column_name = 'vector'
  ) THEN
    ALTER TABLE embeddings ALTER COLUMN vector TYPE vector(1536);
  END IF;
END $$;

