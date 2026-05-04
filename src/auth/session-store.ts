/**
 * Session store for Pitchey custom auth.
 *
 * Replaces the misnamed `better-auth-neon-raw-sql.ts` shim. Despite the prior
 * filename, that file never invoked the Better Auth library — it was a thin
 * raw-SQL session manager. This file is the same logic, renamed and stripped
 * of unused BA imports.
 *
 * History: rip tracked in issue #19, completed 2026-05-04.
 */

import { neon } from '@neondatabase/serverless';

export interface SessionStoreEnv {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET?: string;
  JWT_SECRET?: string;
  SESSIONS_KV?: any;
  KV?: any;
  FRONTEND_URL?: string;
  ENVIRONMENT?: string;
}

function toArray<T>(result: any): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }
  return [];
}

export interface SessionStore {
  findUser(email: string): Promise<Record<string, unknown> | undefined>;
  findUserById(id: string): Promise<Record<string, unknown> | undefined>;
  createSession(userId: string, expiresAt: Date): Promise<string>;
  findSession(sessionId: string): Promise<Record<string, unknown> | undefined>;
  deleteSession(sessionId: string): Promise<void>;
  deleteExpiredSessions(): Promise<void>;
}

export function createSessionStore(env: SessionStoreEnv): SessionStore {
  const sql = neon(env.DATABASE_URL);

  return {

    async findUser(email: string) {
      const result = await sql`
        SELECT id, email, username, user_type, password_hash, password_hash AS password,
               first_name, last_name, company_name, profile_image, subscription_tier,
               bio,
               COALESCE(name, username, email) as name
        FROM users
        WHERE email = ${email}
        LIMIT 1
      `;
      const rows = toArray<Record<string, unknown>>(result);
      return rows[0];
    },

    async findUserById(id: string) {
      const result = await sql`
        SELECT id, email, username, user_type,
               first_name, last_name, company_name, profile_image, subscription_tier,
               bio,
               COALESCE(name, username, email) as name
        FROM users
        WHERE id = ${id}
        LIMIT 1
      `;
      const rows = toArray<Record<string, unknown>>(result);
      return rows[0];
    },

    async createSession(userId: string, expiresAt: Date) {
      const sessionId = crypto.randomUUID();
      const sessionToken = crypto.randomUUID();
      await sql`
        INSERT INTO sessions (id, user_id, token, expires_at, created_at)
        VALUES (${sessionId}, ${userId}, ${sessionToken}, ${expiresAt}, NOW())
      `;
      return sessionId;
    },

    async findSession(sessionId: string) {
      const result = await sql`
        SELECT s.id, s.user_id, s.expires_at,
               u.id as user_id, u.email, u.username, u.user_type,
               u.first_name, u.last_name, u.company_name,
               u.profile_image, u.subscription_tier,
               u.bio,
               COALESCE(u.name, u.username, u.email) as name
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ${sessionId}
        AND s.expires_at > NOW()
        LIMIT 1
      `;
      const rows = toArray<Record<string, unknown>>(result);
      return rows[0];
    },

    async deleteSession(sessionId: string) {
      await sql`DELETE FROM sessions WHERE id = ${sessionId}`;
    },

    async deleteExpiredSessions() {
      await sql`DELETE FROM sessions WHERE expires_at < NOW()`;
    },
  };
}
