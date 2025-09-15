import { registerAs } from '@nestjs/config'

export const appConfig = registerAs('app', () => ({
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3002', 10),
  databaseUrl: process.env.DATABASE_URL!,
  swaggerEnabled: process.env.SWAGGER_ENABLED === 'true',
  supabase: {
    projectUrl: process.env.SUPABASE_PROJECT_URL!,
    jwksUrl: process.env.SUPABASE_JWKS_URL!,
  },
}))

