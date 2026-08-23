import 'dotenv/config';
import { z } from 'zod';

const boolFromEnv = z.preprocess(
  (v) => (typeof v === 'string' ? v === 'true' || v === '1' : v),
  z.boolean(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z
    .string()
    .default('postgres://fume:fume@localhost:5433/fume'),
  DEV_AUTH_KEY: z.string().default('dev'),
  DEFAULT_PROVIDER: z.enum(['mock', 'deepseek']).default('mock'),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().default('https://api.deepseek.com'),
  DEEPSEEK_MODEL: z.string().default('deepseek-chat'),
  LWA_PROFILE_URL: z.string().default('https://api.amazon.com/user/profile'),
  LWA_TOKEN_CACHE_TTL_MS: z.coerce.number().default(300000),
  MEMORY_EXTRACTION_ENABLED: boolFromEnv.default(true),
  MEMORY_IMPORTANCE_THRESHOLD: z.coerce.number().default(0.6),
  MEMORY_RETRIEVE_LIMIT: z.coerce.number().default(8),
  CONTEXT_WINDOW_LAST_N: z.coerce.number().default(20),
  SUMMARY_ON_END: boolFromEnv.default(false),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('invalid env:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
