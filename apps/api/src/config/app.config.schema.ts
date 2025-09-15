import { z } from "zod";

export const appConfigSchema = z
  .object({
    NODE_ENV: z.string().default("development"),
    PORT: z.string().optional(),
    // Make URLs optional for local dev; services should handle undefined gracefully
    DATABASE_URL: z.string().url().optional(),
    SWAGGER_ENABLED: z.enum(["true", "false"]).default("true"),
    SUPABASE_PROJECT_URL: z.string().url().optional(),
    SUPABASE_JWKS_URL: z.string().url().optional(),
  })
  .transform((env) => env);
