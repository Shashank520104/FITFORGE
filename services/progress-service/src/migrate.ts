import "dotenv/config";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { loadProgressConfig } from "./config.js";

async function migrate(): Promise<void> {
  const config = loadProgressConfig();
  const pool = new Pool({ connectionString: config.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(48293172)");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    const versions = [
      "001_progress",
      "002_activity_sleep",
      "003_activity_time",
    ];
    for (const version of versions) {
      const applied = await client.query(
        "SELECT 1 FROM schema_migrations WHERE version = $1",
        [version],
      );
      if (applied.rowCount === 0) {
        const migration = await readFile(
          new URL(`../migrations/${version}.sql`, import.meta.url),
          "utf8",
        );
        await client.query(migration);
        await client.query(
          "INSERT INTO schema_migrations (version) VALUES ($1)",
          [version],
        );
      }
    }
    await client.query("COMMIT");
    console.log(
      `Progress Service database migrations applied: ${versions.join(", ")}`,
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Progress Service migration rollback failed",
        rollbackError instanceof Error ? rollbackError.name : "UnknownError",
      );
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void migrate().catch((error: unknown) => {
  console.error(
    "Progress Service database migration failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  process.exitCode = 1;
});
