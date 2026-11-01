import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),
  CLIENT_URL: z.string().url(),
});

export const env = envSchema.parse({
  ...process.env,
  SUPABASE_SERVICE_ROLE_KEY: process.env.secret_api_key_supabase ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
});
