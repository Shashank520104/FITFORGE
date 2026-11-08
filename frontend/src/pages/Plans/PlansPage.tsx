import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Empty } from "../../components/common/Empty.js";
import { Notice } from "../../components/common/Notice.js";
import { PageHeading } from "../../components/common/PageHeading.js";
import type {
  ApiResponse,
  Exercise,
  Plan,
  Profile,
  WorkoutInsight,
  WorkoutSession,
} from "../../types/index.js";
import {
  displayWeight,
  formatNumber,
  weightInDisplayUnits,
  weightInKilograms,
} from "../../utils/formatters.js";

export function PlansPage({
  api,
}: {
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
}) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [insights, setInsights] = useState<WorkoutInsight[]>([]);
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(
    null,
  );
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [restSecondsRemaining, setRestSecondsRemaining] = useState(0);
  const [units, setUnits] = useState<"metric" | "imperial">("metric");

  const load = useCallback(async () => {
    try {
      const [
        planResult,
        exerciseResult,
        sessionResult,
        profileResult,
        insightResult,
      ] = await Promise.all([
        api<ApiResponse<Plan[]>>("/api/v1/workout-plans?limit=100"),
        api<ApiResponse<Exercise[]>>("/api/v1/exercises?limit=100"),
        api<
          ApiResponse<WorkoutSession[]> & {
            active: WorkoutSession | null;
            pagination: { page: number; limit: number; total: number };
          }
        >("/api/v1/workout-sessions?limit=20"),
        api<ApiResponse<Profile>>("/api/v1/profile"),
        api<ApiResponse<WorkoutInsight[]> & { sessionsAnalyzed: number }>(
          "/api/v1/workout-sessions/insights",
        ),
      ]);
      setError("");
      setPlans(planResult.data);
      setExercises(exerciseResult.data);
      setSessions(sessionResult.data);
      setActiveSession(sessionResult.active);
      setUnits(profileResult.data.units);
      setInsights(insightResult.data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Plans could not be loaded.",
      );
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (restSecondsRemaining <= 0) return;
    const timer = window.setTimeout(
      () => setRestSecondsRemaining((remaining) => Math.max(0, remaining - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [restSecondsRemaining]);

  async function startSession(planId: string, day: number) {
    setBusy(true);
    setError("");
    try {
      const result = await api<ApiResponse<WorkoutSession>>(
        "/api/v1/workout-sessions",
        {
          method: "POST",
          body: JSON.stringify({ planId, day }),
        },
      );
      setActiveSession(result.data);
      setRestSecondsRemaining(0);
      await load();
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Workout could not be started.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function recordSet(
    event: FormEvent<HTMLFormElement>,
    exerciseIndex: number,
    setIndex: number,
    restSeconds: number,
  ) {
    event.preventDefault();
    if (!activeSession) return;
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const result = await api<ApiResponse<WorkoutSession>>(
        `/api/v1/workout-sessions/${activeSession._id}/sets`,
        {
          method: "PATCH",
          body: JSON.stringify({
            exerciseIndex,
            setIndex,
            reps: Number(fields.get("reps")),
            weight: weightInKilograms(Number(fields.get("weight")), units),
          }),
        },
      );
      setActiveSession(result.data);
      setRestSecondsRemaining(restSeconds);
    } catch (recordError) {
      setError(
        recordError instanceof Error
          ? recordError.message
          : "Set could not be recorded.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function closeSession(action: "finish" | "abandon") {
    if (!activeSession) return;
    if (
      action === "abandon" &&
      !window.confirm(
        "Abandon this workout? Its recorded sets will remain in your history.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/api/v1/workout-sessions/${activeSession._id}/${action}`, {
        method: "POST",
      });
      setActiveSession(null);
      setRestSecondsRemaining(0);
      await load();
    } catch (closeError) {
      setError(
        closeError instanceof Error
          ? closeError.message
          : "Workout could not be closed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/api/v1/workout-plans", {
        method: "POST",
        body: JSON.stringify({
          name: fields.get("name"),
          goal: fields.get("goal"),
          days: [
            {
              day: 1,
              name: fields.get("dayName"),
              exercises: [
                {
                  exerciseId: fields.get("exerciseId"),
                  sets: Array.from(
                    { length: Number(fields.get("sets")) },
                    () => ({
                      reps: Number(fields.get("reps")),
                      restSeconds: Number(fields.get("restSeconds")),
                    }),
                  ),
                },
              ],
            },
          ],
        }),
      });
      setShowForm(false);
      await load();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Plan could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function removePlan(id: string) {
    if (!window.confirm("Delete this training plan?")) return;
    try {
      await api(`/api/v1/workout-plans/${id}`, { method: "DELETE" });
      await load();
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Plan could not be deleted.",
      );
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="STRUCTURE YOUR WEEK"
        title="Training plans"
        description="Organize your movements into a repeatable routine."
        action={
          <button
            className="button primary"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? "Close form" : "+ New plan"}
          </button>
        }
      />
      {error && <Notice onRetry={() => void load()}>{error}</Notice>}
      <section
        className="surface insights-surface"
        aria-labelledby="insights-title"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">BASED ON YOUR COMPLETED SESSIONS</p>
            <h2 id="insights-title">Training trends</h2>
          </div>
          <span className="muted">Logged work only</span>
        </div>
        {insights.length ? (
          <div className="insight-grid">
            {insights.map((insight) => (
              <article
                className={`insight-card trend-${insight.direction}`}
                key={insight.exerciseId}
              >
                <div className="insight-heading">
                  <h3>{insight.exerciseName}</h3>
                  <span className={`trend-badge trend-${insight.direction}`}>
                    {insight.direction === "new"
                      ? "NEW"
                      : insight.direction === "up"
                        ? "UP"
                        : insight.direction === "down"
                          ? "DOWN"
                          : "STEADY"}
                  </span>
                </div>
                {insight.previous ? (
                  <>
                    <p className="insight-change">
                      {insight.changePercent === null
                        ? "Compared with your previous logged session"
                        : `${insight.changePercent > 0 ? "+" : ""}${formatNumber(insight.changePercent)}% logged volume`}
                    </p>
                    <p className="muted">
                      {formatNumber(
                        weightInDisplayUnits(insight.latest.volumeKg, units),
                        0,
                      )}{" "}
                      {units === "metric" ? "kg" : "lb"}-reps logged · top set{" "}
                      {displayWeight(insight.latest.topSet.weightKg, units)}{" "}
                      {units === "metric" ? "kg" : "lb"} ×{" "}
                      {insight.latest.topSet.reps}
                    </p>
                  </>
                ) : (
                  <p className="muted">
                    One completed session logged. Your next session creates a
                    comparison.
                  </p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">
            Complete and log sets in two sessions to see exercise-by-exercise
            trends here. Only your recorded work is compared.
          </p>
        )}
      </section>
      {activeSession && (
        <section className="surface active-session">
          <div className="section-heading">
            <div>
              <p className="eyebrow">WORKOUT IN PROGRESS</p>
              <h2>
                {activeSession.planName} · {activeSession.dayName}
              </h2>
            </div>
            <span className="session-live">
              <span /> ACTIVE
            </span>
          </div>
          <div className="session-exercises">
            {activeSession.exercises.map((exercise, exerciseIndex) => {
              const previousSession = sessions.find(
                (candidate) =>
                  candidate.status === "completed" &&
                  new Date(candidate.startedAt) <
                    new Date(activeSession.startedAt) &&
                  candidate.exercises.some(
                    (previousExercise) =>
                      previousExercise.exerciseId === exercise.exerciseId &&
                      previousExercise.sets.some((set) => set.completedAt),
                  ),
              );
              const previousExercise = previousSession?.exercises.find(
                (candidate) => candidate.exerciseId === exercise.exerciseId,
              );
              const previousTopSet = previousExercise?.sets
                .filter(
                  (set) =>
                    set.completedAt &&
                    set.actualReps !== undefined &&
                    set.actualWeight !== undefined,
                )
                .sort(
                  (first, second) =>
                    Number(second.actualWeight) - Number(first.actualWeight),
                )[0];

              return (
                <article
                  className="session-exercise"
                  key={`${exercise.exerciseId}-${exerciseIndex}`}
                >
                  <h3>{exercise.exerciseName}</h3>
                  {previousTopSet && previousSession && (
                    <p className="previous-performance">
                      Previous logged top set:{" "}
                      {displayWeight(
                        Number(previousTopSet.actualWeight),
                        units,
                      )}{" "}
                      {units === "metric" ? "kg" : "lb"} ×{" "}
                      {previousTopSet.actualReps} reps ·{" "}
                      {new Date(previousSession.startedAt).toLocaleDateString()}
                    </p>
                  )}
                  <div className="session-set-list">
                    {exercise.sets.map((set, setIndex) => (
                      <form
                        className={`session-set ${set.completedAt ? "set-complete" : ""}`}
                        key={`${exerciseIndex}-${setIndex}`}
                        onSubmit={(event) =>
                          void recordSet(
                            event,
                            exerciseIndex,
                            setIndex,
                            set.restSeconds,
                          )
                        }
                      >
                        <span className="set-number">SET {setIndex + 1}</span>
                        <label>
                          Reps
                          <input
                            name="reps"
                            type="number"
                            min="1"
                            max="100"
                            defaultValue={set.actualReps ?? set.plannedReps}
                            disabled={Boolean(set.completedAt)}
                            required
                          />
                        </label>
                        <label>
                          Load ({units === "metric" ? "kg" : "lb"})
                          <input
                            name="weight"
                            type="number"
                            min="0"
                            max={units === "metric" ? "500" : "1102"}
                            step="0.5"
                            defaultValue={displayWeight(
                              set.actualWeight ?? set.plannedWeight ?? 0,
                              units,
                            )}
                            disabled={Boolean(set.completedAt)}
                            required
                          />
                        </label>
                        {set.completedAt ? (
                          <span className="set-saved" aria-label="Set recorded">
                            ✓ SAVED
                          </span>
                        ) : (
                          <button className="button secondary" disabled={busy}>
                            Record set
                          </button>
                        )}
                      </form>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
          {restSecondsRemaining > 0 && (
            <p className="rest-timer" role="status">
              Rest timer · {Math.floor(restSecondsRemaining / 60)}:
              {String(restSecondsRemaining % 60).padStart(2, "0")}
              <button
                className="text-button"
                onClick={() => setRestSecondsRemaining(0)}
              >
                Skip
              </button>
            </p>
          )}
          <div className="session-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void closeSession("abandon")}
            >
              Abandon workout
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void closeSession("finish")}
            >
              {busy ? "Saving…" : "Finish workout"}
            </button>
          </div>
        </section>
      )}
      {showForm && (
        <form className="surface form-surface" onSubmit={createPlan}>
          <p className="eyebrow">NEW TRAINING PLAN</p>
          <div className="form-grid">
            <label>
              Plan name
              <input
                name="name"
                required
                maxLength={80}
                placeholder="e.g. Full body A/B"
              />
            </label>
            <label>
              Training goal
              <select name="goal">
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
              Day name
              <input
                name="dayName"
                required
                maxLength={60}
                defaultValue="Day 1"
              />
            </label>
            <label>
              First movement
              <select name="exerciseId" required disabled={!exercises.length}>
                <option value="">Choose an exercise</option>
                {exercises.map((exercise) => (
                  <option key={exercise._id} value={exercise._id}>
                    {exercise.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sets
              <input
                name="sets"
                type="number"
                min="1"
                max="10"
                defaultValue="3"
                required
              />
            </label>
            <label>
              Reps per set
              <input
                name="reps"
                type="number"
                min="1"
                max="100"
                defaultValue="8"
                required
              />
            </label>
            <label>
              Rest (seconds)
              <input
                name="restSeconds"
                type="number"
                min="0"
                max="3600"
                defaultValue="90"
                required
              />
            </label>
          </div>
          {!exercises.length && (
            <p className="muted">
              The exercise catalogue must have movements before a plan can be
              created.
            </p>
          )}
          <button
            className="button primary"
            disabled={busy || !exercises.length}
          >
            {busy ? "Saving…" : "Save plan"}
          </button>
        </form>
      )}
      {plans.length ? (
        <div className="plan-grid">
          {plans.map((plan) => (
            <article className="surface saved-plan" key={plan._id}>
              <div className="plan-top">
                <span className="plan-symbol">↗</span>
                <button
                  className="icon-button danger-text"
                  aria-label={`Delete ${plan.name}`}
                  onClick={() => void removePlan(plan._id)}
                >
                  ×
                </button>
              </div>
              <p className="eyebrow">{plan.goal.replaceAll("_", " ")}</p>
              <h2>{plan.name}</h2>
              <p className="muted">
                {plan.days.length} training{" "}
                {plan.days.length === 1 ? "day" : "days"}
              </p>
              {plan.days.map((day) => (
                <div className="plan-day plan-day-action" key={day.day}>
                  <span>
                    <b>{day.name}</b>
                    <small>
                      {day.exercises.length} movement
                      {day.exercises.length === 1 ? "" : "s"} ·{" "}
                      {day.exercises.reduce(
                        (total, exercise) => total + exercise.sets.length,
                        0,
                      )}{" "}
                      sets
                    </small>
                  </span>
                  <button
                    className="text-button"
                    disabled={busy || Boolean(activeSession)}
                    onClick={() => void startSession(plan._id, day.day)}
                  >
                    Start →
                  </button>
                </div>
              ))}
            </article>
          ))}
        </div>
      ) : (
        <div className="surface">
          <Empty
            text="Your training plans will live here."
            action="Create your first plan"
            onClick={() => setShowForm(true)}
          />
        </div>
      )}
      <section className="surface session-history">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR TRAINING LOG</p>
            <h2>Workout history</h2>
          </div>
          <span className="muted">{sessions.length} sessions</span>
        </div>
        {sessions.length ? (
          <div className="history-list">
            {sessions.map((session) => {
              const completedSets = session.exercises.reduce(
                (count, exercise) =>
                  count + exercise.sets.filter((set) => set.completedAt).length,
                0,
              );
              const totalSets = session.exercises.reduce(
                (count, exercise) => count + exercise.sets.length,
                0,
              );
              return (
                <article className="history-row" key={session._id}>
                  <span className={`history-status ${session.status}`}>
                    {session.status}
                  </span>
                  <div>
                    <b>
                      {session.planName} · {session.dayName}
                    </b>
                    <small>
                      {new Date(session.startedAt).toLocaleString()} ·{" "}
                      {completedSets}/{totalSets} sets logged
                    </small>
                  </div>
                  {session.status === "active" && (
                    <button
                      className="text-button"
                      onClick={() => setActiveSession(session)}
                    >
                      Resume →
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <Empty
            text="Completed workouts will appear here."
            action="Start a plan day"
            onClick={() =>
              document
                .querySelector(".plan-grid")
                ?.scrollIntoView({ behavior: "smooth", block: "center" })
            }
          />
        )}
      </section>
      <p className="small-note">
        Workout sessions snapshot the plan when started. Recorded sets and
        completed or abandoned sessions remain in your history.
      </p>
    </>
  );
}
