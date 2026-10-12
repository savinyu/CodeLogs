import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  // Read by the Inngest SDK straight from process.env. Dev: INNGEST_DEV=1 (local dev server).
  // Production: INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY from the Inngest dashboard.
  INNGEST_DEV: z.string().optional(),
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Server-only env, validated on first use so modules that never touch it (adapters, tests) don't need it set. */
export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Invalid or missing env vars: ${missing}. See .env.example.`);
    }
    cached = parsed.data;
  }
  return cached;
}
