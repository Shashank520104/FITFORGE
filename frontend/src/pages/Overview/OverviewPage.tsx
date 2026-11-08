import { useCallback, useEffect, useState } from "react";
import { Empty } from "../../components/common/Empty.js";
import { Notice } from "../../components/common/Notice.js";
import { Stat } from "../../components/common/Stat.js";
import type {
  ActivityProgressDay,
  ApiResponse,
  Measurement,
  Page,
  Plan,
  Profile,
  StrengthRecord,
  Totals,
  User,
} from "../../types/index.js";
import {
  addDays,
  chartDayLabel,
  dateOnly,
  displayWeight,
  formatNumber,
  today,
} from "../../utils/formatters.js";

export function WeeklyActivityTracker({
  data,
  onOpen,
}: {
  data: ActivityProgressDay[];
  onOpen: () => void;
}) {
  const activeDays = data.filter(
    (entry) => Number(entry.activity_count) > 0,
  ).length;
  const totalMinutes = data.reduce(
    (total, entry) => total + Number(entry.activity_minutes),
    0,
  );
  const peakMinutes = Math.max(
    1,
    ...data.map((entry) => Number(entry.activity_minutes)),
  );

  return (
    <section className="surface weekly-activity-card">
      <div className="weekly-tracker-copy">
        <p className="eyebrow">YOUR WEEKLY MOMENTUM</p>
        <h2>Every small effort counts.</h2>
        <p className="muted">
          {activeDays
            ? `${activeDays} ${activeDays === 1 ? "day" : "days"} with movement logged this week. Keep finding your own rhythm.`
            : "Your week is a fresh start. Log a movement session whenever you’re ready."}
        </p>
        <button className="text-button" onClick={onOpen}>
          See activity & sleep <span aria-hidden="true">→</span>
        </button>
      </div>
      <div className="weekly-tracker-visual">
        <div
          className="momentum-ring"
          role="img"
          aria-label={`${activeDays} days with movement logged this week`}
        >
          <svg viewBox="0 0 72 72" aria-hidden="true">
            <circle className="momentum-ring-track" cx="36" cy="36" r="28" />
            <circle
              className="momentum-ring-progress"
              cx="36"
              cy="36"
              r="28"
              style={{ strokeDashoffset: 176 * (1 - activeDays / 7) }}
            />
          </svg>
          <span>
            <strong>{activeDays}</strong>
            <small>of 7 days</small>
          </span>
        </div>
        <div
          className="weekly-bars"
          role="img"
          aria-label={`Activity logged by day. ${formatNumber(totalMinutes, 0)} active minutes this week.`}
        >
          {data.map((entry, index) => {
            const minutes = Number(entry.activity_minutes);
            return (
              <div
                className="weekly-bar-column"
                key={entry.summary_date}
                title={`${chartDayLabel(entry.summary_date)}: ${minutes} active minutes`}
              >
                <div className="weekly-bar-track">
                  <span
                    className={
                      minutes ? "weekly-bar has-activity" : "weekly-bar"
                    }
                    style={{
                      height: `${minutes ? Math.max(9, (minutes / peakMinutes) * 100) : 0}%`,
                      animationDelay: `${index * 65}ms`,
                    }}
                  />
                </div>
                <small>{chartDayLabel(entry.summary_date).slice(0, 1)}</small>
              </div>
            );
          })}
          <span className="weekly-total">
            <strong>{formatNumber(totalMinutes, 0)}</strong>
            <small>active min</small>
          </span>
        </div>
      </div>
    </section>
  );
}

export function OverviewPage({
  api,
  onNavigate,
  user,
}: {
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
  onNavigate: (page: Page) => void;
  user: User;
}) {
  const [greetingHour] = useState(() => new Date().getHours());
  const [plans, setPlans] = useState<Plan[]>([]);
  const [summary, setSummary] = useState<{
    measurements: Measurement[];
    personalRecords: StrengthRecord[];
  } | null>(null);
  const [weeklyProgress, setWeeklyProgress] = useState<ActivityProgressDay[]>(
    [],
  );
  const [nutrition, setNutrition] = useState<Totals | null>(null);
  const [units, setUnits] = useState<"metric" | "imperial">("metric");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const weekEnd = today();
    const [
      planResult,
      progressResult,
      nutritionResult,
      profileResult,
      weekResult,
    ] = await Promise.allSettled([
      api<ApiResponse<Plan[]>>("/api/v1/workout-plans?limit=5"),
      api<
        ApiResponse<{
          measurements: Measurement[];
          personalRecords: StrengthRecord[];
        }>
      >("/api/v1/progress/summary"),
      api<ApiResponse<unknown[]>>(`/api/v1/nutrition/logs?date=${today()}`),
      api<ApiResponse<Profile>>("/api/v1/profile"),
      api<ApiResponse<ActivityProgressDay[]>>(
        `/api/v1/activity/summary?from=${addDays(weekEnd, -6)}&to=${weekEnd}`,
      ),
    ]);
    if (planResult.status === "fulfilled") setPlans(planResult.value.data);
    if (progressResult.status === "fulfilled")
      setSummary(progressResult.value.data);
    if (nutritionResult.status === "fulfilled") {
      setNutrition(
        nutritionResult.value.data.length
          ? (nutritionResult.value.total ?? null)
          : null,
      );
    }
    if (profileResult.status === "fulfilled")
      setUnits(profileResult.value.data.units);
    if (weekResult.status === "fulfilled")
      setWeeklyProgress(weekResult.value.data);
    const failed = [
      planResult,
      progressResult,
      nutritionResult,
      profileResult,
      weekResult,
    ].filter((result) => result.status === "rejected");
    if (failed.length)
      setError("Some dashboard information could not be loaded.");
    else setError("");
    setLoading(false);
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);
  const latestWeight = summary?.measurements.at(-1);
  const latestPR = summary?.personalRecords[0];
  const greeting =
    greetingHour < 12 ? "morning" : greetingHour < 18 ? "afternoon" : "evening";

  return (
    <>
      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <span className="welcome-pill">
            <i aria-hidden="true" /> YOUR SPACE, YOUR PACE
          </span>
          <h1>
            Good {greeting}, {user.email.split("@")[0]}.
            <br />
            <em>Show up for you.</em>
          </h1>
          <p>
            Stronger routines start with small steps. See what you’ve logged and
            choose one thing to do for yourself today.
          </p>
          <div className="dashboard-hero-actions">
            <button
              className="button primary"
              onClick={() => onNavigate("activity")}
            >
              Log today’s activity <span aria-hidden="true">→</span>
            </button>
            <button
              className="button hero-secondary"
              onClick={() => onNavigate("progress")}
            >
              Explore progress
            </button>
          </div>
        </div>
        <div className="dashboard-hero-art" aria-hidden="true">
          <div className="hero-orbit hero-orbit-outer" />
          <div className="hero-orbit hero-orbit-inner" />
          <svg viewBox="0 0 220 180" role="presentation">
            <path d="M25 130c24-3 31-48 59-42s34 35 59 17 31-50 52-55" />
            <circle cx="84" cy="88" r="6" />
            <circle cx="143" cy="105" r="6" />
            <circle cx="195" cy="50" r="6" />
          </svg>
          <span className="hero-art-note">A little progress, often.</span>
        </div>
      </section>
      {error && (
        <Notice
          onRetry={() => {
            setLoading(true);
            void load();
          }}
        >
          {error}
        </Notice>
      )}
      <div className="stats-grid">
        <Stat
          label="TODAY'S CALORIES"
          value={
            nutrition ? `${formatNumber(nutrition.calories, 0)} kcal` : "—"
          }
          detail={
            nutrition
              ? "From your logged meals"
              : "Log a meal to see your total"
          }
        />
        <Stat
          label="LATEST WEIGHT"
          value={
            latestWeight
              ? `${displayWeight(Number(latestWeight.weight_kg), units)} ${units === "metric" ? "kg" : "lb"}`
              : "—"
          }
          detail={
            latestWeight
              ? `Measured ${dateOnly(latestWeight.measured_on)}`
              : "Add a measurement to begin"
          }
        />
        <Stat
          label="TRAINING PLANS"
          value={String(plans.length)}
          detail={
            plans.length ? "Ready when you are" : "Create your first plan"
          }
        />
        <Stat
          label="TOP LIFT"
          value={
            latestPR
              ? `${displayWeight(Number(latestPR.weight_kg), units)} ${units === "metric" ? "kg" : "lb"}`
              : "—"
          }
          detail={latestPR?.exercise_name ?? "Log a strength record"}
        />
      </div>
      <WeeklyActivityTracker
        data={weeklyProgress}
        onOpen={() => onNavigate("activity")}
      />
      <section className="dashboard-grid">
        <div className="surface">
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR ROUTINE</p>
              <h2>Training plans</h2>
            </div>
            <button className="text-button" onClick={() => onNavigate("plans")}>
              View all ↗
            </button>
          </div>
          {loading ? (
            <p className="muted">Loading your plans…</p>
          ) : plans.length ? (
            <div className="plan-list">
              {plans.slice(0, 3).map((plan) => (
                <button
                  className="plan-row"
                  key={plan._id}
                  onClick={() => onNavigate("plans")}
                >
                  <span className="plan-symbol">↗</span>
                  <span>
                    <b>{plan.name}</b>
                    <small>
                      {plan.days.length} training{" "}
                      {plan.days.length === 1 ? "day" : "days"} ·{" "}
                      {plan.goal.replaceAll("_", " ")}
                    </small>
                  </span>
                  <span className="row-arrow">→</span>
                </button>
              ))}
            </div>
          ) : (
            <Empty
              text="No training plan yet."
              action="Create a plan"
              onClick={() => onNavigate("plans")}
            />
          )}
        </div>
        <div className="surface quick-actions">
          <p className="eyebrow">KEEP IT MOVING</p>
          <h2>What's next?</h2>
          <button
            className="quick-link"
            onClick={() => onNavigate("exercises")}
          >
            <span>01</span>
            <b>Explore exercises</b>
            <i>→</i>
          </button>
          <button
            className="quick-link"
            onClick={() => onNavigate("nutrition")}
          >
            <span>02</span>
            <b>Log a meal</b>
            <i>→</i>
          </button>
          <button className="quick-link" onClick={() => onNavigate("progress")}>
            <span>03</span>
            <b>Record progress</b>
            <i>→</i>
          </button>
        </div>
      </section>
      <section className="surface assist-banner">
        <div>
          <p className="eyebrow">BUILT AROUND YOUR DATA</p>
          <h2>Progress, without the guesswork.</h2>
          <p className="muted">
            Your charts only show measurements and training records you've
            entered.
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => onNavigate("progress")}
        >
          View progress <span>→</span>
        </button>
      </section>
    </>
  );
}
