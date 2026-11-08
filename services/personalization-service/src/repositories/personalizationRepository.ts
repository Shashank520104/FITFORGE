import { Pool } from "pg";
import {
  EncryptedReportRecord,
  HealthReportRow,
  WellnessPlanRecord,
  WellnessProfileRecord,
} from "../types/index.js";

export class PersonalizationRepository {
  constructor(private readonly pool: Pool) {}

  async getProfile(ownerId: string): Promise<WellnessProfileRecord | null> {
    const result = await this.pool.query<WellnessProfileRecord>(
      `SELECT height_cm AS "heightCm", weight_kg AS "weightKg",
              diet_preference AS "dietPreference",
              experience_level AS "experienceLevel",
              exercise_cleared AS "exerciseCleared", updated_at AS "updatedAt"
       FROM wellness_profiles WHERE owner_id = $1`,
      [ownerId],
    );
    return result.rows[0] ?? null;
  }

  async upsertProfile(
    ownerId: string,
    profile: {
      heightCm: number;
      weightKg: number;
      dietPreference: string;
      experienceLevel: string;
      exerciseCleared: boolean;
    },
  ): Promise<WellnessProfileRecord> {
    const result = await this.pool.query<WellnessProfileRecord>(
      `INSERT INTO wellness_profiles
         (owner_id, height_cm, weight_kg, diet_preference, experience_level,
          exercise_cleared)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (owner_id) DO UPDATE SET
         height_cm = EXCLUDED.height_cm,
         weight_kg = EXCLUDED.weight_kg,
         diet_preference = EXCLUDED.diet_preference,
         experience_level = EXCLUDED.experience_level,
         exercise_cleared = EXCLUDED.exercise_cleared,
         updated_at = now()
       RETURNING height_cm AS "heightCm", weight_kg AS "weightKg",
                 diet_preference AS "dietPreference",
                 experience_level AS "experienceLevel",
                 exercise_cleared AS "exerciseCleared", updated_at AS "updatedAt"`,
      [
        ownerId,
        profile.heightCm,
        profile.weightKg,
        profile.dietPreference,
        profile.experienceLevel,
        profile.exerciseCleared,
      ],
    );
    await this.pool.query("DELETE FROM personalized_plans WHERE owner_id = $1", [
      ownerId,
    ]);
    return result.rows[0];
  }

  async listReports(ownerId: string): Promise<HealthReportRow[]> {
    const result = await this.pool.query<HealthReportRow>(
      `SELECT id, filename, media_type AS "mediaType",
              file_size AS "fileSize", created_at AS "createdAt"
       FROM health_reports WHERE owner_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [ownerId],
    );
    return result.rows;
  }

  async saveEncryptedReport(
    id: string,
    ownerId: string,
    filename: string,
    contentType: string,
    size: number,
    ciphertext: Buffer,
    iv: Buffer,
    authTag: Buffer,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO health_reports
           (id, owner_id, filename, media_type, file_size, encrypted_content,
            initialization_vector, authentication_tag)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, ownerId, filename, contentType, size, ciphertext, iv, authTag],
      );
      await client.query(
        `UPDATE wellness_profiles
         SET exercise_cleared = false, updated_at = now()
         WHERE owner_id = $1`,
        [ownerId],
      );
      await client.query(
        `UPDATE personalized_plans
         SET plan = jsonb_set(plan, '{workoutDays}', 'null'::jsonb, true)
         WHERE owner_id = $1`,
        [ownerId],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getEncryptedReport(
    id: string,
    ownerId: string,
  ): Promise<EncryptedReportRecord | null> {
    const result = await this.pool.query<EncryptedReportRecord>(
      `SELECT id, filename, media_type, file_size, encrypted_content,
              initialization_vector, authentication_tag
       FROM health_reports WHERE id = $1 AND owner_id = $2`,
      [id, ownerId],
    );
    return result.rows[0] ?? null;
  }

  async deleteReport(id: string, ownerId: string): Promise<boolean> {
    const result = await this.pool.query(
      "DELETE FROM health_reports WHERE id = $1 AND owner_id = $2",
      [id, ownerId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getPlan(
    ownerId: string,
  ): Promise<{ plan: WellnessPlanRecord; generatedAt: string } | null> {
    const result = await this.pool.query<{ plan: WellnessPlanRecord; generatedAt: string }>(
      `SELECT plan, generated_at AS "generatedAt"
       FROM personalized_plans WHERE owner_id = $1`,
      [ownerId],
    );
    return result.rows[0] ?? null;
  }

  async savePlan(ownerId: string, plan: WellnessPlanRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO personalized_plans (owner_id, plan, generated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (owner_id) DO UPDATE
       SET plan = EXCLUDED.plan, generated_at = now()`,
      [ownerId, JSON.stringify(plan)],
    );
  }
}
