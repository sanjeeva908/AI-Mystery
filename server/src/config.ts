import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

if (process.env.NODE_ENV !== 'test') {
  const envPath = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../.env')].find(existsSync);
  if (envPath) dotenv.config({ path: envPath });
}
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  MONGODB_URI: z.string().optional().default(''),
  MONGODB_DB_NAME: z.string().default('ai_mystery_room'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-3.5-flash-lite'),
  GENERATION_TIMEOUT_MS: z.coerce.number().int().positive().default(90000),
  CASE_TTL_DAYS: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX_CASES: z.coerce.number().int().positive().default(3),
  MAX_PREMISE_LENGTH: z.coerce.number().int().positive().max(1500).default(1500),
});
export const config = envSchema.parse(process.env);