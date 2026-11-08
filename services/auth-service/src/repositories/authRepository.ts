import { Pool, PoolClient } from "pg";
import { AuthUser, UserRecord } from "../types/index.js";
import { hashRefreshToken } from "../utils/token.js";

export class AuthRepository {
  constructor(private readonly pool: Pool) {}

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const result = await this.pool.query<UserRecord>(
      "SELECT id, email, password_hash FROM users WHERE email = $1",
      [email.trim().toLowerCase()],
    );
    return result.rows[0] ?? null;
  }

  async findUserById(id: string): Promise<AuthUser | null> {
    const result = await this.pool.query<AuthUser>(
      "SELECT id, email FROM users WHERE id = $1",
      [id],
    );
    return result.rows[0] ?? null;
  }

  async createUserWithSession(
    email: string,
    passwordHash: string,
    refreshToken: string,
    refreshTokenTtlDays: number,
  ): Promise<AuthUser> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const insertUser = await client.query<AuthUser>(
        `INSERT INTO users (email, password_hash)
         VALUES ($1, $2)
         RETURNING id, email`,
        [email, passwordHash],
      );
      const user = insertUser.rows[0];
      if (!user) {
        throw new Error("User insert returned no row");
      }

      await client.query(
        `INSERT INTO refresh_sessions (user_id, token_hash, expires_at)
         VALUES ($1, $2, now() + ($3 * interval '1 day'))`,
        [user.id, hashRefreshToken(refreshToken), refreshTokenTtlDays],
      );
      await client.query("COMMIT");
      return user;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async createRefreshSession(
    userId: string,
    token: string,
    refreshTokenTtlDays: number,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO refresh_sessions (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + ($3 * interval '1 day'))`,
      [userId, hashRefreshToken(token), refreshTokenTtlDays],
    );
  }

  async rotateRefreshSession(
    presentedToken: string,
    nextRefreshToken: string,
    refreshTokenTtlDays: number,
  ): Promise<AuthUser | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<AuthUser>(
        `UPDATE refresh_sessions AS session
         SET revoked_at = now()
         FROM users
         WHERE session.user_id = users.id
           AND session.token_hash = $1
           AND session.revoked_at IS NULL
           AND session.expires_at > now()
         RETURNING users.id, users.email`,
        [hashRefreshToken(presentedToken)],
      );
      const user = result.rows[0];
      if (!user) {
        await client.query("ROLLBACK");
        return null;
      }

      await client.query(
        `INSERT INTO refresh_sessions (user_id, token_hash, expires_at)
         VALUES ($1, $2, now() + ($3 * interval '1 day'))`,
        [user.id, hashRefreshToken(nextRefreshToken), refreshTokenTtlDays],
      );
      await client.query("COMMIT");
      return user;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async revokeSession(token: string): Promise<void> {
    await this.pool.query(
      "UPDATE refresh_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL",
      [hashRefreshToken(token)],
    );
  }
}
