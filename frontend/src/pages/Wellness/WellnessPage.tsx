import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PageHeading } from "../../components/common/PageHeading.js";
import type {
  ApiResponse,
  HealthReport,
  ReportSummary,
  WellnessPlan,
  WellnessProfile,
} from "../../types/index.js";

export function WellnessPage({
  api,
}: {
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
}) {
  const [profile, setProfile] = useState<WellnessProfile | null>(null);
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [dietPreference, setDietPreference] =
    useState<WellnessProfile["dietPreference"]>("non_vegetarian");
  const [experienceLevel, setExperienceLevel] =
    useState<WellnessProfile["experienceLevel"]>("beginner");
  const [exerciseCleared, setExerciseCleared] = useState(false);
  const [reports, setReports] = useState<HealthReport[]>([]);
  const [plan, setPlan] = useState<WellnessPlan | null>(null);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [reportConsent, setReportConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [workingReportId, setWorkingReportId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadWellnessData = useCallback(async () => {
    try {
      const [profileResponse, reportResponse, planResponse] = await Promise.all(
        [
          api<ApiResponse<WellnessProfile | null>>("/api/v1/wellness/profile"),
          api<ApiResponse<HealthReport[]>>("/api/v1/wellness/reports"),
          api<ApiResponse<WellnessPlan | null>>("/api/v1/wellness/plan"),
        ],
      );
      const savedProfile = profileResponse.data;
      setProfile(savedProfile);
      if (savedProfile) {
        setHeightCm(String(savedProfile.heightCm));
        setWeightKg(String(savedProfile.weightKg));
        setDietPreference(savedProfile.dietPreference);
        setExperienceLevel(savedProfile.experienceLevel);
        setExerciseCleared(savedProfile.exerciseCleared);
      }
      setReports(reportResponse.data);
      setPlan(planResponse.data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load your wellness information.",
      );
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void loadWellnessData();
  }, [loadWellnessData]);

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setError("");
    setMessage("");
    try {
      const response = await api<ApiResponse<WellnessProfile>>(
        "/api/v1/wellness/profile",
        {
          method: "PUT",
          body: JSON.stringify({
            heightCm: Number(heightCm),
            weightKg: Number(weightKg),
            dietPreference,
            experienceLevel,
            exerciseCleared,
          }),
        },
      );
      setProfile(response.data);
      setPlan(null);
      setSelectedDay(1);
      setMessage("Preferences saved. Create a new week to apply your changes.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save your wellness preferences.",
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function uploadReport() {
    if (!reportFile || !reportConsent) return;
    setUploading(true);
    setError("");
    setMessage("");
    setSummary(null);
    try {
      const response = await api<ApiResponse<HealthReport>>(
        "/api/v1/wellness/reports",
        {
          method: "POST",
          headers: {
            "content-type": reportFile.type,
            "x-file-name": encodeURIComponent(reportFile.name),
          },
          body: reportFile,
        },
      );
      setReports((current) => [response.data, ...current]);
      setExerciseCleared(false);
      setProfile((current) =>
        current ? { ...current, exerciseCleared: false } : current,
      );
      setPlan((current) =>
        current
          ? {
              ...current,
              workoutDays: null,
              exerciseCleared: false,
              workoutNotice:
                "A report was added. Check with your clinician and confirm exercise clearance before seeing workout ideas.",
            }
          : current,
      );
      setReportFile(null);
      setReportConsent(false);
      const input = document.getElementById(
        "wellness-report-file",
      ) as HTMLInputElement | null;
      if (input) input.value = "";
      setMessage(
        "Report uploaded and encrypted. Workout suggestions are hidden until you confirm clinician clearance.",
      );
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not upload this report.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function summarizeReport(report: HealthReport) {
    setWorkingReportId(report.id);
    setError("");
    setMessage("");
    setSummary(null);
    try {
      const response = await api<ApiResponse<ReportSummary>>(
        `/api/v1/wellness/reports/${report.id}/summary`,
        { method: "POST" },
      );
      setSummary(response.data);
    } catch (summaryError) {
      setError(
        summaryError instanceof Error
          ? summaryError.message
          : "Could not summarize this report.",
      );
    } finally {
      setWorkingReportId("");
    }
  }

  async function deleteReport(report: HealthReport) {
    if (
      !window.confirm(
        `Delete ${report.filename}? This permanently removes the encrypted report.`,
      )
    ) {
      return;
    }
    setWorkingReportId(report.id);
    setError("");
    setMessage("");
    try {
      await api<ApiResponse<{ deleted: boolean }>>(
        `/api/v1/wellness/reports/${report.id}`,
        { method: "DELETE" },
      );
      setReports((current) =>
        current.filter((entry) => entry.id !== report.id),
      );
      if (summary?.reportId === report.id) setSummary(null);
      setMessage(
        "Report deleted. Workout clearance still needs to be confirmed separately.",
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete this report.",
      );
    } finally {
      setWorkingReportId("");
    }
  }

  async function generatePlan() {
    setGenerating(true);
    setError("");
    setMessage("");
    setSelectedDay(1);
    try {
      const response = await api<ApiResponse<WellnessPlan>>(
        "/api/v1/wellness/plan/generate",
        { method: "POST" },
      );
      setPlan(response.data);
      setMessage("Your new seven-day plan is ready.");
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Could not generate your plan. Please try again.",
      );
    } finally {
      setGenerating(false);
    }
  }

  const selectedDietDay = plan?.dietDays.find((day) => day.day === selectedDay);
  const selectedWorkoutDay = plan?.workoutDays?.find(
    (day) => day.day === selectedDay,
  );

  return (
    <section className="wellness-page">
      <PageHeading
        eyebrow="YOUR PERSONAL WELLNESS SPACE"
        title="A plan that starts with you."
        description="Set your preferences, keep your records private, and build practical weekly ideas around your routine."
        action={
          <button
            className="button primary"
            onClick={() => void generatePlan()}
            disabled={loading || generating || !profile}
          >
            {generating
              ? "Building your week…"
              : plan
                ? "Refresh my plan"
                : "Create my week"}{" "}
            <span aria-hidden="true">↗</span>
          </button>
        }
      />
      <div className="wellness-notice" role="note">
        <span aria-hidden="true">✳</span>
        <div>
          <strong>General support, never medical advice.</strong>
          <p>
            FITFORGE cannot diagnose conditions, decide if exercise is safe, or
            create recovery diets. Reports are kept private and are never used
            to generate a plan.
          </p>
        </div>
      </div>
      {error && (
        <p className="wellness-feedback error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="wellness-feedback success" role="status">
          {message}
        </p>
      )}
      {loading ? (
        <div className="surface wellness-loading" role="status">
          <span className="loading-dot" />
          Loading your private wellness space…
        </div>
      ) : (
        <>
          <div className="wellness-grid">
            <form
              className="surface wellness-card wellness-preferences"
              onSubmit={savePreferences}
            >
              <div className="wellness-card-heading">
                <span className="wellness-icon" aria-hidden="true">
                  ◈
                </span>
                <div>
                  <p className="eyebrow">YOUR STARTING POINT</p>
                  <h2>Personalize your week</h2>
                </div>
              </div>
              <p className="muted">
                These details help the local model suggest everyday meals and,
                only when you confirm, gentle movement ideas.
              </p>
              <div className="wellness-form-grid">
                <label>
                  Height <span>cm</span>
                  <input
                    type="number"
                    min="100"
                    max="250"
                    step="0.1"
                    value={heightCm}
                    onChange={(event) => setHeightCm(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Weight <span>kg</span>
                  <input
                    type="number"
                    min="30"
                    max="350"
                    step="0.1"
                    value={weightKg}
                    onChange={(event) => setWeightKg(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Food preference
                  <select
                    value={dietPreference}
                    onChange={(event) =>
                      setDietPreference(
                        event.target.value as WellnessProfile["dietPreference"],
                      )
                    }
                  >
                    <option value="vegetarian">Vegetarian</option>
                    <option value="non_vegetarian">Non-vegetarian</option>
                    <option value="vegan">Vegan</option>
                  </select>
                </label>
                <label>
                  Training experience
                  <select
                    value={experienceLevel}
                    onChange={(event) =>
                      setExperienceLevel(
                        event.target
                          .value as WellnessProfile["experienceLevel"],
                      )
                    }
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </label>
              </div>
              <label className="wellness-clearance">
                <input
                  type="checkbox"
                  checked={exerciseCleared}
                  onChange={(event) => setExerciseCleared(event.target.checked)}
                />
                <span>
                  A qualified clinician has confirmed that general exercise is
                  appropriate for me.
                </span>
              </label>
              <p className="wellness-helper">
                If you are unsure, leave this unchecked and ask your clinician.
                FITFORGE does not verify or make this decision for you.
              </p>
              <button
                className="button secondary"
                type="submit"
                disabled={savingProfile}
              >
                {savingProfile ? "Saving…" : "Save preferences"}
              </button>
            </form>

            <section className="surface wellness-card wellness-reports">
              <div className="wellness-card-heading">
                <span className="wellness-icon report" aria-hidden="true">
                  ▤
                </span>
                <div>
                  <p className="eyebrow">PRIVATE BY DESIGN</p>
                  <h2>Health reports</h2>
                </div>
              </div>
              <p className="muted">
                Add a report to keep it encrypted in your account. Ask local
                Ollama for a plain-language summary only when you choose.
              </p>
              <label className="wellness-upload">
                <span aria-hidden="true">＋</span>
                <span>
                  {reportFile ? reportFile.name : "Choose a report to upload"}
                  <small>PDF, JPG, or PNG · up to 8 MB</small>
                </span>
                <input
                  id="wellness-report-file"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={(event) =>
                    setReportFile(event.target.files?.[0] ?? null)
                  }
                  disabled={uploading}
                />
              </label>
              {reportFile && reportFile.size > 8 * 1024 * 1024 && (
                <p className="wellness-helper error">
                  This report is larger than 8 MB.
                </p>
              )}
              {reportFile && (
                <button
                  className="button secondary full"
                  onClick={() => void uploadReport()}
                  disabled={
                    uploading ||
                    !reportConsent ||
                    reportFile.size > 8 * 1024 * 1024
                  }
                >
                  {uploading ? "Encrypting and uploading…" : "Upload securely"}
                </button>
              )}
              <label className="wellness-consent">
                <input
                  type="checkbox"
                  checked={reportConsent}
                  onChange={(event) => setReportConsent(event.target.checked)}
                />
                <span>
                  I understand this sensitive file is stored encrypted until I
                  delete it. If I ask for a summary, extracted text is sent to
                  the local Ollama model and the summary is not saved.
                </span>
              </label>
              {reports.length > 0 ? (
                <div className="wellness-report-list">
                  {reports.map((report) => (
                    <article className="wellness-report" key={report.id}>
                      <span className="report-file-icon" aria-hidden="true">
                        {report.mediaType === "application/pdf" ? "PDF" : "IMG"}
                      </span>
                      <div className="wellness-report-details">
                        <strong title={report.filename}>
                          {report.filename}
                        </strong>
                        <small>
                          {new Date(report.createdAt).toLocaleDateString()} ·{" "}
                          {(report.fileSize / (1024 * 1024)).toFixed(1)} MB
                        </small>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => void summarizeReport(report)}
                        disabled={workingReportId === report.id}
                      >
                        {workingReportId === report.id
                          ? "Reading…"
                          : "Summarize"}
                      </button>
                      <button
                        className="wellness-delete"
                        aria-label={`Delete ${report.filename}`}
                        onClick={() => void deleteReport(report)}
                        disabled={workingReportId === report.id}
                      >
                        ×
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="wellness-empty">
                  No reports saved. You can use weekly meal suggestions without
                  uploading medical documents.
                </p>
              )}
              {summary && (
                <div className="wellness-summary" aria-live="polite">
                  <p className="eyebrow">
                    AI SUMMARY · CHECK AGAINST THE ORIGINAL
                  </p>
                  <pre>{summary.summary}</pre>
                  <p>{summary.note}</p>
                </div>
              )}
            </section>
          </div>

          {!exerciseCleared && (
            <div className="wellness-safety" role="note">
              <span aria-hidden="true">!</span>
              <div>
                <strong>Workout ideas are currently hidden</strong>
                <p>
                  Exercising before a clinician reviews a relevant condition or
                  treatment could worsen symptoms or delay recovery. FITFORGE
                  cannot tell whether that applies to your report, so it will
                  not make that decision for you. Ask a qualified clinician and
                  confirm clearance above before generating workout ideas.
                </p>
              </div>
            </div>
          )}

          <section className="surface wellness-plan">
            <div className="wellness-plan-heading">
              <div>
                <p className="eyebrow">BUILT AROUND YOUR PREFERENCES</p>
                <h2>Your seven-day guide</h2>
                <p className="muted">
                  Everyday food inspiration and, when cleared, gentle movement
                  ideas. No calorie targets or recovery prescriptions.
                </p>
              </div>
              {plan && (
                <span className="wellness-generated">
                  Updated {new Date(plan.generatedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            {plan ? (
              <>
                <div className="wellness-day-picker" aria-label="Plan day">
                  {plan.dietDays.map((day) => {
                    const workoutDay = plan.workoutDays?.find(
                      (w) => w.day === day.day,
                    );
                    const isRest =
                      workoutDay && workoutDay.activities.length === 0;
                    return (
                      <button
                        key={day.day}
                        className={`${selectedDay === day.day ? "active" : ""} ${isRest ? "day-rest" : ""}`}
                        onClick={() => setSelectedDay(day.day)}
                      >
                        <small>DAY</small>
                        <strong>{day.day}</strong>
                        {workoutDay && (
                          <span
                            className={`wellness-day-tag ${isRest ? "rest" : "active"}`}
                            title={workoutDay.focus}
                          >
                            {isRest
                              ? "Rest"
                              : workoutDay.focus
                                  .replace(/ & .*/, "")
                                  .slice(0, 8)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="wellness-day-content">
                  <section className="wellness-plan-column">
                    <h3>
                      <span aria-hidden="true">◉</span> Meals for day{" "}
                      {selectedDay}
                    </h3>
                    <div className="wellness-meals">
                      {selectedDietDay?.meals.map((meal) => (
                        <article key={meal.name}>
                          <span>{meal.name}</span>
                          <ul>
                            {meal.suggestions.map((suggestion) => (
                              <li key={suggestion}>{suggestion}</li>
                            ))}
                          </ul>
                        </article>
                      ))}
                    </div>
                  </section>
                  {plan.workoutDays && (
                    <section className="wellness-plan-column">
                      <h3>
                        <span aria-hidden="true">↗</span> Movement for day{" "}
                        {selectedDay}
                      </h3>
                      {selectedWorkoutDay ? (
                        <>
                          <p className="wellness-focus">
                            <strong>Daily Focus:</strong>{" "}
                            {selectedWorkoutDay.focus}
                          </p>
                          {selectedWorkoutDay.activities.length > 0 ? (
                            selectedWorkoutDay.activities.map(
                              (activity, idx) => (
                                <article
                                  className="wellness-activity"
                                  key={`${activity.name}-${activity.minutes}-${idx}`}
                                >
                                  <div>
                                    <strong>{activity.name}</strong>
                                    <span>
                                      {activity.minutes} min · gentle pace
                                    </span>
                                  </div>
                                  <p>{activity.guidance}</p>
                                </article>
                              ),
                            )
                          ) : (
                            <div className="wellness-rest-card">
                              <strong>Scheduled Rest & Recovery</strong>
                              <p>
                                A designated rest day to allow muscles and
                                joints to recover. Light stretching or a casual
                                stroll is optional if it feels comfortable.
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="wellness-empty">
                          No movement suggestions for this day.
                        </p>
                      )}
                    </section>
                  )}
                  {!plan.workoutDays && (
                    <section className="wellness-plan-column wellness-gated">
                      <span className="wellness-lock" aria-hidden="true">
                        ◉
                      </span>
                      <h3>Movement plan hidden</h3>
                      <p>
                        {plan.workoutNotice ??
                          (exerciseCleared
                            ? "Your clearance is saved. Generate a new plan to see general movement ideas."
                            : "Workout suggestions stay hidden until you confirm that a clinician has cleared exercise.")}
                      </p>
                    </section>
                  )}
                </div>
                <p className="wellness-plan-notice">{plan.notice}</p>
              </>
            ) : (
              <div className="wellness-plan-empty">
                <span aria-hidden="true">✳</span>
                <h3>Your next week, made more personal.</h3>
                <p>
                  Save your height, weight, and food preference, then create
                  everyday meal ideas. Workout ideas stay hidden until you
                  confirm clinician clearance.
                </p>
                <button
                  className="button primary"
                  onClick={() => void generatePlan()}
                  disabled={generating || !profile}
                >
                  {generating ? "Building your week…" : "Create my week"} ↗
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
