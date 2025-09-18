DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'Role' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');
  END IF;
END $$;

-- Ensure any existing text values are valid before the type cast
UPDATE users SET role = 'USER' WHERE role NOT IN ('USER', 'ADMIN');

-- Alter users.role from text -> Role enum
ALTER TABLE users
  ALTER COLUMN role DROP DEFAULT;

ALTER TABLE users
  ALTER COLUMN role TYPE "Role" USING (role::text::"Role");

ALTER TABLE users
  ALTER COLUMN role SET DEFAULT 'USER'::"Role";
