// API token storage. Every query is scoped by userId, except lookup by hash for authentication.

import "server-only";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { apiTokens, users } from "@/lib/db/schema";
import {
  EXTENSION_TOKEN_NAME,
  generateToken,
  hashToken,
  MAX_TOKENS_PER_USER,
  parseBearer,
  tokenPrefix,
} from "./api-tokens-shared";

export interface ApiTokenSummary {
  id: string;
  name: string;
  tokenPrefix: string;
  /** ISO timestamps. */
  createdAt: string;
  lastUsedAt: string | null;
}

export async function listApiTokens(userId: string): Promise<ApiTokenSummary[]> {
  const rows = await db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      tokenPrefix: apiTokens.tokenPrefix,
      createdAt: apiTokens.createdAt,
      lastUsedAt: apiTokens.lastUsedAt,
    })
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId))
    .orderBy(desc(apiTokens.createdAt));
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
  }));
}

/** Creates a token and returns it in full: the only time it's ever available. */
export async function createApiToken(
  userId: string,
  name: string,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const [existing] = await db
    .select({ n: count() })
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId));
  if ((existing?.n ?? 0) >= MAX_TOKENS_PER_USER) {
    return {
      ok: false,
      error: `You can have up to ${MAX_TOKENS_PER_USER} tokens. Revoke one first.`,
    };
  }
  const token = generateToken();
  await db
    .insert(apiTokens)
    .values({ userId, name, tokenHash: hashToken(token), tokenPrefix: tokenPrefix(token) });
  return { ok: true, token };
}

/**
 * Creates the token the browser extension gets when it connects itself. At the cap, the least
 * recently used "Browser extension" token is replaced (delete + insert in one batch).
 */
export async function connectExtensionToken(
  userId: string,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const [existing] = await db
    .select({ n: count() })
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId));
  const token = generateToken();
  const insert = db.insert(apiTokens).values({
    userId,
    name: EXTENSION_TOKEN_NAME,
    tokenHash: hashToken(token),
    tokenPrefix: tokenPrefix(token),
  });
  if ((existing?.n ?? 0) < MAX_TOKENS_PER_USER) {
    await insert;
    return { ok: true, token };
  }
  const [oldest] = await db
    .select({ id: apiTokens.id })
    .from(apiTokens)
    .where(and(eq(apiTokens.userId, userId), eq(apiTokens.name, EXTENSION_TOKEN_NAME)))
    .orderBy(sql`${apiTokens.lastUsedAt} asc nulls first`, asc(apiTokens.createdAt))
    .limit(1);
  if (!oldest) {
    return {
      ok: false,
      error: `You have ${MAX_TOKENS_PER_USER} tokens. Revoke one on the CodeLogs Connect page, then connect again.`,
    };
  }
  await db.batch([
    db.delete(apiTokens).where(and(eq(apiTokens.userId, userId), eq(apiTokens.id, oldest.id))),
    insert,
  ]);
  return { ok: true, token };
}

/** Deletes one of the user's tokens. Returns false if it wasn't theirs or didn't exist. */
export async function revokeApiToken(userId: string, id: string): Promise<boolean> {
  const deleted = await db
    .delete(apiTokens)
    .where(and(eq(apiTokens.userId, userId), eq(apiTokens.id, id)))
    .returning({ id: apiTokens.id });
  return deleted.length > 0;
}

export interface TokenUser {
  userId: string;
  username: string | null;
}

/**
 * The user behind an `Authorization: Bearer` header, or null. Records the use (at most once a
 * minute per token, so polling doesn't write on every call).
 */
export async function authenticateBearer(header: string | null): Promise<TokenUser | null> {
  const token = parseBearer(header);
  if (!token) return null;
  const [row] = await db
    .select({ id: apiTokens.id, userId: apiTokens.userId, username: users.username })
    .from(apiTokens)
    .innerJoin(users, eq(users.id, apiTokens.userId))
    .where(eq(apiTokens.tokenHash, hashToken(token)))
    .limit(1);
  if (!row) return null;
  await db
    .update(apiTokens)
    .set({ lastUsedAt: sql`now()` })
    .where(
      and(
        eq(apiTokens.id, row.id),
        sql`(${apiTokens.lastUsedAt} IS NULL OR ${apiTokens.lastUsedAt} < now() - interval '1 minute')`,
      ),
    );
  return { userId: row.userId, username: row.username };
}
