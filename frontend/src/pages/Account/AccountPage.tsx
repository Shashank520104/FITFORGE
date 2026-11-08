import { useEffect, useState, type FormEvent } from "react";
import { Notice } from "../../components/common/Notice.js";
import { PageHeading } from "../../components/common/PageHeading.js";
import type { ApiResponse, Profile, User } from "../../types/index.js";

export function AccountPage({
  api,
  user,
  onLogout,
}: {
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
  user: User;
  onLogout: () => Promise<void>;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api<ApiResponse<Profile>>("/api/v1/profile")
      .then((result) => {
        if (active) setProfile(result.data);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Your profile could not be loaded.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [api]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setSaved(false);
    setError("");
    try {
      const result = await api<ApiResponse<Profile>>("/api/v1/profile", {
        method: "PATCH",
        body: JSON.stringify({
          displayName: String(fields.get("displayName") ?? "").trim() || null,
          units: fields.get("units"),
          trainingGoal: fields.get("trainingGoal") || null,
          experienceLevel: fields.get("experienceLevel") || null,
          equipment: fields.getAll("equipment"),
          dietaryPreferences: fields.getAll("dietaryPreferences"),
        }),
      });
      setProfile(result.data);
      setSaved(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Your profile could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="ACCOUNT"
        title="Your account"
        description="Manage your FITFORGE sign-in."
      />
      <section className="surface account-surface">
        <span className="avatar large-avatar">
          {user.email[0]?.toUpperCase()}
        </span>
        <div>
          <p className="eyebrow">EMAIL ADDRESS</p>
          <h2>{user.email}</h2>
          <p className="muted">Your preferences are private to your account.</p>
        </div>
      </section>
      {error && <Notice>{error}</Notice>}
      {!profile ? (
        <section className="surface profile-form">
          <p className="muted">
            {error
              ? "Your preferences are unavailable right now."
              : "Loading your preferences…"}
          </p>
          {error && (
            <button
              className="button secondary"
              onClick={() => {
                setError("");
                void api<ApiResponse<Profile>>("/api/v1/profile")
                  .then((result) => setProfile(result.data))
                  .catch((loadError: unknown) =>
                    setError(
                      loadError instanceof Error
                        ? loadError.message
                        : "Your profile could not be loaded.",
                    ),
                  );
              }}
            >
              Try again
            </button>
          )}
        </section>
      ) : (
        <form
          className="surface profile-form"
          onSubmit={(event) => void saveProfile(event)}
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR PREFERENCES</p>
              <h2>Personalize your space</h2>
            </div>
          </div>
          <div className="form-grid">
            <label>
              Display name
              <input
                name="displayName"
                maxLength={80}
                defaultValue={profile.display_name ?? ""}
                placeholder="How should we address you?"
              />
            </label>
            <label>
              Units
              <select name="units" defaultValue={profile.units}>
                <option value="metric">Metric (kg, cm)</option>
                <option value="imperial">Imperial (lb, in)</option>
              </select>
            </label>
            <label>
              Training goal
              <select
                name="trainingGoal"
                defaultValue={profile.training_goal ?? ""}
              >
                <option value="">Not specified</option>
                <option value="general_fitness">General fitness</option>
                <option value="muscle_gain">Muscle gain</option>
                <option value="fat_loss">Fat loss</option>
                <option value="powerlifting">Powerlifting</option>
                <option value="athletic_performance">
                  Athletic performance
                </option>
              </select>
            </label>
            <label>
              Experience
              <select
                name="experienceLevel"
                defaultValue={profile.experience_level ?? ""}
              >
                <option value="">Not specified</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
          </div>
          <fieldset className="preference-group">
            <legend>Available equipment</legend>
            {[
              ["bodyweight", "Bodyweight"],
              ["dumbbell", "Dumbbells"],
              ["barbell", "Barbells"],
              ["machine", "Machines"],
              ["band", "Resistance bands"],
            ].map(([value, label]) => (
              <label className="preference-option" key={value}>
                <input
                  type="checkbox"
                  name="equipment"
                  value={value}
                  defaultChecked={profile.equipment.includes(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <fieldset className="preference-group">
            <legend>Dietary preferences</legend>
            {[
              ["vegetarian", "Vegetarian"],
              ["vegan", "Vegan"],
              ["pescatarian", "Pescatarian"],
              ["halal", "Halal"],
              ["kosher", "Kosher"],
              ["gluten_free", "Gluten-free"],
              ["dairy_free", "Dairy-free"],
            ].map(([value, label]) => (
              <label className="preference-option" key={value}>
                <input
                  type="checkbox"
                  name="dietaryPreferences"
                  value={value}
                  defaultChecked={profile.dietary_preferences.includes(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <div className="profile-save">
            {saved && (
              <span className="success-message" role="status">
                Preferences saved.
              </span>
            )}
            <button className="button primary" disabled={busy}>
              {busy ? "Saving…" : "Save preferences"}
            </button>
          </div>
        </form>
      )}
      <button
        className="button secondary logout-button"
        onClick={() => void onLogout()}
      >
        Sign out
      </button>
    </>
  );
}
