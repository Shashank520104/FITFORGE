import { Pool } from "pg";
import {
  ActivityRecord,
  Measurement,
  SleepRecord,
  StrengthRecord,
} from "../types/index.js";

export class ProgressRepository {
  constructor(private readonly pool: Pool) {}

  async logActivity(
    ownerId: string,
    data: {
      activityDate: string;
      activityTime: string;
      activityType: string;
      durationMinutes: number;
      distanceKm?: number;
      note?: string;
    },
  ): Promise<any> {
    const result = await this.pool.query(
      `INSERT INTO activity_logs
        (owner_id, activity_date, activity_time, activity_type, duration_minutes, distance_km, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, activity_date, activity_time, activity_type, duration_minutes, distance_km, note, source, created_at`,
      [
        ownerId,
        data.activityDate,
        data.activityTime,
        data.activityType,
        data.durationMinutes,
        data.distanceKm ?? null,
        data.note ?? null,
      ],
    );
    return result.rows[0];
  }

  async logSleep(
    ownerId: string,
    data: {
      sleepDate: string;
      bedtime: string;
      wakeTime: string;
      durationMinutes: number;
      note?: string;
    },
  ): Promise<any> {
    const result = await this.pool.query(
      `INSERT INTO sleep_logs
        (owner_id, sleep_date, bedtime, wake_time, duration_minutes, note)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, sleep_date, bedtime, wake_time, duration_minutes, note, source, created_at`,
      [
        ownerId,
        data.sleepDate,
        data.bedtime,
        data.wakeTime,
        data.durationMinutes,
        data.note ?? null,
      ],
    );
    return result.rows[0];
  }

  async getDailyActivitiesAndSleep(ownerId: string, date: string): Promise<any> {
    const [activities, sleep] = await Promise.all([
      this.pool.query(
        `SELECT id, activity_date, activity_time, activity_type, duration_minutes, distance_km, note, source, created_at
         FROM activity_logs WHERE owner_id = $1 AND activity_date = $2
         ORDER BY activity_time, created_at`,
        [ownerId, date],
      ),
      this.pool.query(
        `SELECT id, sleep_date, bedtime, wake_time, duration_minutes, note, source, created_at
         FROM sleep_logs WHERE owner_id = $1 AND sleep_date = $2
         ORDER BY created_at`,
        [ownerId, date],
      ),
    ]);
    return {
      activities: activities.rows,
      sleep: sleep.rows,
      activityMinutes: activities.rows.reduce(
        (total, activity) => total + Number(activity.duration_minutes),
        0,
      ),
      sleepMinutes: sleep.rows.reduce(
        (total, record) => total + Number(record.duration_minutes),
        0,
      ),
    };
  }

  async getActivitySummary(ownerId: string, from: string, to: string): Promise<any[]> {
    const result = await this.pool.query(
      `WITH days AS (
         SELECT generate_series($2::date, $3::date, interval '1 day')::date AS summary_date
       ),
       activities AS (
         SELECT activity_date, SUM(duration_minutes) AS activity_minutes,
                SUM(COALESCE(distance_km, 0)) AS distance_km,
                COUNT(*) AS activity_count
         FROM activity_logs
         WHERE owner_id = $1 AND activity_date BETWEEN $2 AND $3
         GROUP BY activity_date
       ),
       sleep AS (
         SELECT sleep_date, SUM(duration_minutes) AS sleep_minutes,
                COUNT(*) AS sleep_count
         FROM sleep_logs
         WHERE owner_id = $1 AND sleep_date BETWEEN $2 AND $3
         GROUP BY sleep_date
       )
       SELECT days.summary_date,
              COALESCE(activities.activity_minutes, 0) AS activity_minutes,
              COALESCE(activities.distance_km, 0) AS distance_km,
              COALESCE(activities.activity_count, 0) AS activity_count,
              COALESCE(sleep.sleep_minutes, 0) AS sleep_minutes,
              COALESCE(sleep.sleep_count, 0) AS sleep_count
       FROM days
       LEFT JOIN activities ON activities.activity_date = days.summary_date
       LEFT JOIN sleep ON sleep.sleep_date = days.summary_date
       ORDER BY days.summary_date`,
      [ownerId, from, to],
    );
    return result.rows;
  }

  async deleteActivity(id: string, ownerId: string): Promise<boolean> {
    const result = await this.pool.query(
      "DELETE FROM activity_logs WHERE id = $1 AND owner_id = $2 RETURNING id",
      [id, ownerId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async deleteSleep(id: string, ownerId: string): Promise<boolean> {
    const result = await this.pool.query(
      "DELETE FROM sleep_logs WHERE id = $1 AND owner_id = $2 RETURNING id",
      [id, ownerId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async saveMeasurement(ownerId: string, data: Measurement): Promise<any> {
    const result = await this.pool.query(
      `INSERT INTO body_measurements (owner_id, measured_on, weight_kg, body_fat_percent, note)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (owner_id, measured_on) DO UPDATE
       SET weight_kg = EXCLUDED.weight_kg,
           body_fat_percent = EXCLUDED.body_fat_percent,
           note = EXCLUDED.note
     RETURNING id, measured_on, weight_kg, body_fat_percent, note`,
      [
        ownerId,
        data.measuredOn,
        data.weightKg,
        data.bodyFatPercent ?? null,
        data.note ?? null,
      ],
    );
    return result.rows[0];
  }

  async getMeasurements(
    ownerId: string,
    from: string | null,
    to: string | null,
    limit: number,
    offset: number,
  ): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT id, measured_on, weight_kg, body_fat_percent, note
     FROM body_measurements
     WHERE owner_id = $1
       AND ($2::date IS NULL OR measured_on >= $2)
       AND ($3::date IS NULL OR measured_on <= $3)
     ORDER BY measured_on
     LIMIT $4 OFFSET $5`,
      [ownerId, from, to, limit, offset],
    );
    return result.rows;
  }

  async saveStrengthRecord(
    ownerId: string,
    record: StrengthRecord,
  ): Promise<{ data: any; isPersonalRecord: boolean }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `SELECT pg_advisory_xact_lock(
           hashtextextended($1 || ':' || lower($2), 0)
         )`,
        [ownerId, record.exerciseName],
      );
      const previous = await client.query<{ max_weight: string | null }>(
        `SELECT MAX(weight_kg) AS max_weight FROM strength_records
       WHERE owner_id = $1 AND lower(exercise_name) = lower($2)`,
        [ownerId, record.exerciseName],
      );
      const previousBest = Number(previous.rows[0]?.max_weight ?? 0);
      const isPersonalRecord = record.weightKg > previousBest;
      const created = await client.query(
        `INSERT INTO strength_records
        (owner_id, exercise_name, exercise_id, performed_at, weight_kg, repetitions, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, exercise_name, exercise_id, performed_at, weight_kg, repetitions, note`,
        [
          ownerId,
          record.exerciseName,
          record.exerciseId ?? null,
          record.performedAt,
          record.weightKg,
          record.repetitions,
          record.note ?? null,
        ],
      );
      await client.query("COMMIT");
      return { data: created.rows[0], isPersonalRecord };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getStrengthRecords(
    ownerId: string,
    exerciseName: string,
    limit: number,
    offset: number,
  ): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT id, exercise_name, exercise_id, performed_at, weight_kg, repetitions, note
     FROM strength_records
     WHERE owner_id = $1 AND ($2 = '' OR lower(exercise_name) = lower($2))
     ORDER BY performed_at DESC, created_at DESC
     LIMIT $3 OFFSET $4`,
      [ownerId, exerciseName, limit, offset],
    );
    return result.rows;
  }

  async getProgressSummary(ownerId: string): Promise<any> {
    const [measurements, personalRecords] = await Promise.all([
      this.pool.query(
        `SELECT measured_on, weight_kg, body_fat_percent
       FROM body_measurements WHERE owner_id = $1
        ORDER BY measured_on DESC LIMIT 366`,
        [ownerId],
      ),
      this.pool.query(
        `SELECT DISTINCT ON (lower(exercise_name))
         exercise_name, performed_at, weight_kg, repetitions
       FROM strength_records WHERE owner_id = $1
       ORDER BY lower(exercise_name), weight_kg DESC, performed_at DESC`,
        [ownerId],
      ),
    ]);
    return {
      measurements: measurements.rows.reverse(),
      personalRecords: personalRecords.rows,
    };
  }
}
