import { createHash, randomBytes, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { encodeSession, newSession } from "@/lib/auth/session";
import { compileBlocked } from "@/lib/compiler/compile-priority";
import { clampFacetWeight, isFacet, type Facet } from "./facets";
import type { FollowState, FrequencyProfile } from "./rank";

export type FrequencyUser = {
  id: string;
  email: string;
  createdAt: string;
  lastLoginAt: string | null;
  unsubscribedAt: string | null;
};

type MemoryDb = {
  users: FrequencyUser[];
  tokens: Array<{ id: string; userId: string; tokenHash: string; expiresAt: string; usedAt: string | null }>;
  follows: Array<FollowState & { userId: string }>;
  facets: Array<{ userId: string; topicId: string; facet: Facet; weight: number }>;
  interests: Array<{ userId: string; nodeId: string; weight: number }>;
};

const memory: MemoryDb = { users: [], tokens: [], follows: [], facets: [], interests: [] };

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS frequency_users (
    id text PRIMARY KEY,
    email text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_login_at timestamptz,
    unsubscribed_at timestamptz
  )`,
  `CREATE TABLE IF NOT EXISTS frequency_login_tokens (
    id text PRIMARY KEY,
    user_id text NOT NULL REFERENCES frequency_users(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS frequency_follows (
    user_id text NOT NULL REFERENCES frequency_users(id) ON DELETE CASCADE,
    topic_id text NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    weight real NOT NULL DEFAULT 1,
    muted boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, topic_id)
  )`,
  `CREATE TABLE IF NOT EXISTS frequency_facets (
    user_id text NOT NULL REFERENCES frequency_users(id) ON DELETE CASCADE,
    topic_id text NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    facet text NOT NULL,
    weight integer NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, topic_id, facet)
  )`,
  `CREATE TABLE IF NOT EXISTS frequency_classifications (
    subject_id text PRIMARY KEY,
    facet text NOT NULL,
    child text,
    classified_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS frequency_interests (
    user_id text NOT NULL REFERENCES frequency_users(id) ON DELETE CASCADE,
    node_id text NOT NULL,
    weight integer NOT NULL DEFAULT 2,
    PRIMARY KEY (user_id, node_id)
  )`,
];

function useMemory(): boolean {
  return Boolean(process.env.VITEST) || !process.env.DATABASE_URL;
}

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

let schemaReady: Promise<void> | null = null;

export async function ensureFrequencySchema(): Promise<void> {
  if (useMemory()) return;
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = db();
      for (const statement of SCHEMA_STATEMENTS) {
        await sql.query(statement);
      }
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function upsertUserByEmail(email: string): Promise<FrequencyUser> {
  const normalized = normalizeEmail(email);
  if (!normalized || !normalized.includes("@")) throw new Error("invalid_email");
  if (useMemory()) {
    const existing = memory.users.find((row) => row.email === normalized);
    if (existing) return existing;
    const user: FrequencyUser = {
      id: `user_${randomUUID()}`,
      email: normalized,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
      unsubscribedAt: null,
    };
    memory.users.push(user);
    return user;
  }
  await ensureFrequencySchema();
  const sql = db();
  const found = await sql.query("SELECT * FROM frequency_users WHERE email = $1", [normalized]);
  if (found[0]) return mapUser(found[0]);
  const id = `user_${randomUUID()}`;
  await sql.query("INSERT INTO frequency_users (id, email) VALUES ($1, $2)", [id, normalized]);
  const created = await sql.query("SELECT * FROM frequency_users WHERE id = $1", [id]);
  return mapUser(created[0]);
}

export async function getUserById(id: string): Promise<FrequencyUser | null> {
  if (useMemory()) return memory.users.find((row) => row.id === id) ?? null;
  await ensureFrequencySchema();
  const rows = await db().query("SELECT * FROM frequency_users WHERE id = $1", [id]);
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function issueLoginToken(userId: string, ttlMs = 15 * 60_000): Promise<string> {
  const token = newToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  if (useMemory()) {
    memory.tokens.push({ id: `tok_${randomUUID()}`, userId, tokenHash, expiresAt, usedAt: null });
    return token;
  }
  await ensureFrequencySchema();
  await db().query(
    `INSERT INTO frequency_login_tokens (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [`tok_${randomUUID()}`, userId, tokenHash, expiresAt],
  );
  return token;
}

export async function consumeLoginToken(token: string): Promise<FrequencyUser | null> {
  const tokenHash = hashToken(token);
  const now = new Date().toISOString();
  if (useMemory()) {
    const row = memory.tokens.find((item) => item.tokenHash === tokenHash && !item.usedAt);
    if (!row || row.expiresAt < now) return null;
    row.usedAt = now;
    const user = memory.users.find((item) => item.id === row.userId);
    if (user) user.lastLoginAt = now;
    return user ?? null;
  }
  await ensureFrequencySchema();
  const sql = db();
  const rows = await sql.query(
    `SELECT * FROM frequency_login_tokens
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
    [tokenHash],
  );
  const found = rows[0];
  if (!found) return null;
  await sql.query("UPDATE frequency_login_tokens SET used_at = $1 WHERE id = $2", [now, found.id]);
  await sql.query("UPDATE frequency_users SET last_login_at = $1 WHERE id = $2", [now, found.user_id]);
  return getUserById(String(found.user_id));
}

export async function getProfile(userId: string): Promise<FrequencyProfile | null> {
  const user = await getUserById(userId);
  if (!user) return null;
  if (useMemory()) {
    return {
      userId: user.id,
      email: user.email,
      follows: memory.follows.filter((row) => row.userId === userId).map(({ userId: _id, ...rest }) => rest),
      facets: facetsMap(memory.facets.filter((row) => row.userId === userId)),
      interests: interestsMap(memory.interests.filter((row) => row.userId === userId)),
    };
  }
  await ensureFrequencySchema();
  const sql = db();
  const [follows, facets, interests] = await Promise.all([
    sql.query("SELECT topic_id, weight, muted FROM frequency_follows WHERE user_id = $1", [userId]),
    sql.query("SELECT topic_id, facet, weight FROM frequency_facets WHERE user_id = $1", [userId]),
    sql.query("SELECT node_id, weight FROM frequency_interests WHERE user_id = $1", [userId]).catch(() => []),
  ]);
  return {
    userId: user.id,
    email: user.email,
    follows: follows.map((row) => ({
      topicId: String(row.topic_id),
      weight: Number(row.weight ?? 1),
      muted: Boolean(row.muted),
    })),
    facets: facetsMap(
      facets.map((row) => ({
        userId,
        topicId: String(row.topic_id),
        facet: String(row.facet) as Facet,
        weight: Number(row.weight ?? 0),
      })),
    ),
    interests: interestsMap(
      (interests as Array<Record<string, unknown>>).map((row) => ({
        nodeId: String(row.node_id),
        weight: Number(row.weight ?? 0),
      })),
    ),
  };
}

export async function listSubscribedProfiles(): Promise<FrequencyProfile[]> {
  if (useMemory()) {
    const ids = memory.users.filter((row) => !row.unsubscribedAt).map((row) => row.id);
    const profiles = await Promise.all(ids.map((id) => getProfile(id)));
    return profiles.filter((row): row is FrequencyProfile => Boolean(row && row.follows.length));
  }
  await ensureFrequencySchema();
  const rows = await db().query(
    `SELECT id FROM frequency_users
     WHERE unsubscribed_at IS NULL
       AND (
         id IN (SELECT DISTINCT user_id FROM frequency_follows)
         OR id IN (SELECT DISTINCT user_id FROM frequency_interests)
       )`,
  );
  const profiles = await Promise.all(rows.map((row) => getProfile(String(row.id))));
  return profiles.filter((row): row is FrequencyProfile => Boolean(row));
}

export async function setFollow(input: {
  userId: string;
  topicId: string;
  slug: string;
  action: "follow" | "unfollow" | "mute" | "unmute";
}): Promise<FrequencyProfile | null> {
  if (compileBlocked(input.slug)) throw new Error("topic_not_followable");
  if (useMemory()) {
    const key = (row: FollowState & { userId: string }) => row.userId === input.userId && row.topicId === input.topicId;
    if (input.action === "unfollow") {
      memory.follows = memory.follows.filter((row) => !key(row));
      memory.facets = memory.facets.filter((row) => !(row.userId === input.userId && row.topicId === input.topicId));
      return getProfile(input.userId);
    }
    const existing = memory.follows.find(key);
    if (!existing) {
      memory.follows.push({
        userId: input.userId,
        topicId: input.topicId,
        weight: 1,
        muted: input.action === "mute",
      });
    } else if (input.action === "mute") existing.muted = true;
    else if (input.action === "unmute" || input.action === "follow") existing.muted = false;
    return getProfile(input.userId);
  }
  await ensureFrequencySchema();
  const sql = db();
  if (input.action === "unfollow") {
    await sql.query("DELETE FROM frequency_follows WHERE user_id = $1 AND topic_id = $2", [
      input.userId,
      input.topicId,
    ]);
    await sql.query("DELETE FROM frequency_facets WHERE user_id = $1 AND topic_id = $2", [
      input.userId,
      input.topicId,
    ]);
    return getProfile(input.userId);
  }
  const muted = input.action === "mute";
  await sql.query(
    `INSERT INTO frequency_follows (user_id, topic_id, weight, muted, updated_at)
     VALUES ($1, $2, 1, $3, now())
     ON CONFLICT (user_id, topic_id) DO UPDATE SET
       muted = EXCLUDED.muted,
       updated_at = now()`,
    [input.userId, input.topicId, muted],
  );
  if (input.action === "unmute" || input.action === "follow") {
    await sql.query(
      `UPDATE frequency_follows SET muted = false, updated_at = now()
       WHERE user_id = $1 AND topic_id = $2`,
      [input.userId, input.topicId],
    );
  }
  return getProfile(input.userId);
}

export async function setFacet(input: {
  userId: string;
  topicId: string;
  slug: string;
  facet: string;
  weight: number;
}): Promise<FrequencyProfile | null> {
  if (compileBlocked(input.slug)) throw new Error("topic_not_followable");
  if (!isFacet(input.facet)) throw new Error("invalid_facet");
  const weight = clampFacetWeight(input.weight);
  if (useMemory()) {
    const existing = memory.facets.find(
      (row) => row.userId === input.userId && row.topicId === input.topicId && row.facet === input.facet,
    );
    if (existing) existing.weight = weight;
    else memory.facets.push({ userId: input.userId, topicId: input.topicId, facet: input.facet, weight });
    return getProfile(input.userId);
  }
  await ensureFrequencySchema();
  await db().query(
    `INSERT INTO frequency_facets (user_id, topic_id, facet, weight)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, topic_id, facet) DO UPDATE SET weight = EXCLUDED.weight`,
    [input.userId, input.topicId, input.facet, weight],
  );
  return getProfile(input.userId);
}

export async function setUnsubscribed(userId: string, unsubscribed: boolean): Promise<void> {
  const at = unsubscribed ? new Date().toISOString() : null;
  if (useMemory()) {
    const user = memory.users.find((row) => row.id === userId);
    if (user) user.unsubscribedAt = at;
    return;
  }
  await ensureFrequencySchema();
  await db().query("UPDATE frequency_users SET unsubscribed_at = $1 WHERE id = $2", [at, userId]);
}

export async function replaceInterests(input: {
  userId: string;
  weights: Record<string, number>;
}): Promise<FrequencyProfile | null> {
  const next = Object.entries(input.weights)
    .map(([nodeId, weight]) => ({ nodeId, weight: clampFacetWeight(weight) }))
    .filter((row) => row.nodeId);
  if (useMemory()) {
    memory.interests = memory.interests.filter((row) => row.userId !== input.userId);
    for (const row of next) {
      memory.interests.push({ userId: input.userId, nodeId: row.nodeId, weight: row.weight });
    }
    return getProfile(input.userId);
  }
  await ensureFrequencySchema();
  const sql = db();
  await sql.query("DELETE FROM frequency_interests WHERE user_id = $1", [input.userId]);
  for (const row of next) {
    await sql.query(
      `INSERT INTO frequency_interests (user_id, node_id, weight) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, node_id) DO UPDATE SET weight = EXCLUDED.weight`,
      [input.userId, row.nodeId, row.weight],
    );
  }
  return getProfile(input.userId);
}

export function resetFrequencyMemory(): void {
  memory.users = [];
  memory.tokens = [];
  memory.follows = [];
  memory.facets = [];
  memory.interests = [];
}

function mapUser(row: Record<string, unknown>): FrequencyUser {
  return {
    id: String(row.id),
    email: String(row.email),
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : row.lastLoginAt ? String(row.lastLoginAt) : null,
    unsubscribedAt: row.unsubscribed_at
      ? String(row.unsubscribed_at)
      : row.unsubscribedAt
        ? String(row.unsubscribedAt)
        : null,
  };
}

function facetsMap(
  rows: Array<{ topicId: string; facet: Facet; weight: number }>,
): FrequencyProfile["facets"] {
  const out: FrequencyProfile["facets"] = {};
  for (const row of rows) {
    if (!isFacet(row.facet)) continue;
    out[row.topicId] ??= {};
    out[row.topicId][row.facet] = row.weight;
  }
  return out;
}

function interestsMap(rows: Array<{ nodeId: string; weight: number }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    if (!row.nodeId) continue;
    out[row.nodeId] = clampFacetWeight(row.weight);
  }
  return out;
}

export function unsubTokenFor(userId: string): string {
  return encodeSession(newSession(userId));
}
