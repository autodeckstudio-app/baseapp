import { z } from 'zod';

/**
 * Phase 1 is emulator-only. FIREBASE_PROJECT_ID must be a `demo-*` project —
 * Firebase's own tooling refuses to let such IDs connect to anything real,
 * and this schema refuses to boot at all without both emulator hosts set.
 * This is the "fail closed rather than fall back to real Firebase"
 * requirement, enforced at the very first point config is read.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  FIREBASE_PROJECT_ID: z
    .string()
    .min(1)
    .refine((value) => value.startsWith('demo-'), {
      message: 'FIREBASE_PROJECT_ID must start with "demo-" — Phase 1 is emulator-only.',
    }),
  FIRESTORE_EMULATOR_HOST: z.string().min(1, 'FIRESTORE_EMULATOR_HOST is required in Phase 1'),
  FIREBASE_AUTH_EMULATOR_HOST: z.string().min(1, 'FIREBASE_AUTH_EMULATOR_HOST is required in Phase 1'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  return envSchema.parse(config);
}
