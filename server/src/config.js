import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required').optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  // Only needed when the client is hosted on a different origin than the API.
  // Comma-separated list, e.g. "https://eventhub.vercel.app".
  CLIENT_ORIGIN: z.string().optional(),
  // Number of reverse proxies in front of the app (Render/Railway/Nginx = 1).
  TRUST_PROXY: z.coerce.number().int().min(0).optional(),
});

let cached;

/** Parses and validates process.env once. Throws a readable error on misconfiguration. */
export function getConfig() {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  const env = parsed.data;
  const clientOrigins = env.CLIENT_ORIGIN
    ? env.CLIENT_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  cached = {
    env: env.NODE_ENV,
    isProd: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
    port: env.PORT,
    mongoUri: env.MONGO_URI,
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN,
    clientOrigins,
    // Cross-site deployments need SameSite=None cookies; same-origin can use Lax.
    crossSite: clientOrigins.length > 0,
    trustProxy: env.TRUST_PROXY ?? (env.NODE_ENV === 'production' ? 1 : 0),
  };
  return cached;
}
