import { Pool } from "pg";
import { ProfilePatchDto, UserProfileRecord } from "../types/index.js";

export class ProfileRepository {
  constructor(private readonly pool: Pool) {}

  async getOrCreateProfile(ownerId: string): Promise<UserProfileRecord> {
    const result = await this.pool.query<UserProfileRecord>(
      `INSERT INTO user_profiles (owner_id)
       VALUES ($1)
       ON CONFLICT (owner_id) DO UPDATE SET updated_at = user_profiles.updated_at
       RETURNING display_name, units, training_goal, experience_level,
                 equipment, dietary_preferences, created_at, updated_at`,
      [ownerId],
    );
    return result.rows[0];
  }

  async patchProfile(
    ownerId: string,
    patch: ProfilePatchDto,
  ): Promise<UserProfileRecord> {
    const result = await this.pool.query<UserProfileRecord>(
      `INSERT INTO user_profiles
         (owner_id, display_name, units, training_goal, experience_level,
          equipment, dietary_preferences)
       VALUES ($1, $2, COALESCE($3, 'metric'), $4, $5,
               COALESCE($6, ARRAY[]::TEXT[]), COALESCE($7, ARRAY[]::TEXT[]))
       ON CONFLICT (owner_id) DO UPDATE SET
         display_name = CASE WHEN $8 THEN $2 ELSE user_profiles.display_name END,
         units = CASE WHEN $9 THEN $3 ELSE user_profiles.units END,
         training_goal = CASE WHEN $10 THEN $4 ELSE user_profiles.training_goal END,
         experience_level = CASE WHEN $11 THEN $5 ELSE user_profiles.experience_level END,
         equipment = CASE WHEN $12 THEN $6 ELSE user_profiles.equipment END,
         dietary_preferences = CASE WHEN $13 THEN $7 ELSE user_profiles.dietary_preferences END,
         updated_at = now()
       RETURNING display_name, units, training_goal, experience_level,
                 equipment, dietary_preferences, created_at, updated_at`,
      [
        ownerId,
        patch.displayName ?? null,
        patch.units ?? null,
        patch.trainingGoal ?? null,
        patch.experienceLevel ?? null,
        patch.equipment ?? null,
        patch.dietaryPreferences ?? null,
        patch.displayName !== undefined,
        patch.units !== undefined,
        patch.trainingGoal !== undefined,
        patch.experienceLevel !== undefined,
        patch.equipment !== undefined,
        patch.dietaryPreferences !== undefined,
      ],
    );
    return result.rows[0];
  }
}
