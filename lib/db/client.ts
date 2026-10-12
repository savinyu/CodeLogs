import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "@/lib/env";
import * as schema from "./schema";

// Neon over HTTP: one round trip per query, no connection pool to manage on serverless.
// Use db.batch([...]) when several writes must succeed or fail together.
export const db = drizzle({ client: neon(env().DATABASE_URL), schema });

export type DB = typeof db;
