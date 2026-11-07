import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { curveMonotoneX, line } from "d3-shape";
import { extent, max } from "d3-array";
import { scaleLinear, scaleTime } from "d3-scale";
import "./App.css";

type User = { id: string; email: string };
type Session = { user: User; accessToken: string };
type Page =
  | "overview"
  | "plans"
  | "exercises"
  | "nutrition"
  | "activity"
  | "wellness"
  | "progress"
  | "assistant"
  | "account";
type ApiResponse<T> = { success: boolean; data: T; total?: Totals };
type Exercise = {
  _id: string;
  name: string;
  muscleGroups: string[];
  equipment: string[];
  difficulty: string;
  movementType: string;
  description: string;
};
type Plan = {
  _id: string;
  name: string;
  goal: string;
  days: Array<{
    day: number;
    name: string;
    exercises: Array<{ exerciseId: string; sets: Array<{ reps: number }> }>;
  }>;
};
type WorkoutSessionSet = {
  plannedReps: number;
  plannedWeight: number | null;
  restSeconds: number;
  actualReps?: number;
  actualWeight?: number;
  completedAt?: string;
};
type WorkoutSessionExercise = {
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutSessionSet[];
};
type WorkoutSession = {
  _id: string;
  planName: string;
  dayName: string;
  status: "active" | "completed" | "abandoned";
  startedAt: string;
  finishedAt?: string;
  exercises: WorkoutSessionExercise[];
};
type WorkoutInsight = {
  exerciseId: string;
  exerciseName: string;
  direction: "new" | "up" | "steady" | "down";
  changePercent: number | null;
  latest: {
    performedAt: string;
    completedSets: number;
    volumeKg: number;
    topSet: { weightKg: number; reps: number };
  };
  previous: {
    performedAt: string;
    completedSets: number;
    volumeKg: number;
    topSet: { weightKg: number; reps: number };
  } | null;
};
type Profile = {
  display_name: string | null;
  units: "metric" | "imperial";
  training_goal: string | null;
  experience_level: string | null;
  equipment: string[];
  dietary_preferences: string[];
};
type Food = {
  id: string;
  name: string;
  serving_unit: "g" | "ml";
  calories_per_100: string;
  protein_per_100: string;
  carbohydrates_per_100: string;
  fat_per_100: string;
  fiber_per_100: string;
  sodium_mg_per_100: string;
  source_label: string;
};
type NutritionLogItem = {
  foodName: string;
  servingAmount: string;
  servingUnit: string;
  calories: string;
  proteinG: string;
  carbohydratesG: string;
  fatG: string;
  source: string;
};
type NutritionLog = {
  id: string;
  meal_type: string;
  items: NutritionLogItem[];
};
type ActivityRecord = {
  id: string;
  activity_time: string;
  activity_type: string;
  duration_minutes: string;
  distance_km: string | null;
  note: string | null;
  source: string;
};
type SleepRecord = {
  id: string;
  bedtime: string;
  wake_time: string;
  duration_minutes: string;
  note: string | null;
  source: string;
};
type ActivityDay = {
  activities: ActivityRecord[];
  sleep: SleepRecord[];
  activityMinutes: number;
  sleepMinutes: number;
};
type ActivityProgressDay = {
  summary_date: string;
  activity_minutes: string;
  distance_km: string;
  activity_count: string;
  sleep_minutes: string;
  sleep_count: string;
};
type WellnessProfile = {
  heightCm: number;
  weightKg: number;
  dietPreference: "vegetarian" | "non_vegetarian" | "vegan";
  experienceLevel: "beginner" | "intermediate" | "advanced";
  exerciseCleared: boolean;
  updatedAt: string;
};
type HealthReport = {
  id: string;
  filename: string;
  mediaType: string;
  fileSize: number;
  createdAt: string;
};
type WellnessPlan = {
  dietDays: Array<{
    day: number;
    meals: Array<{
      name: "breakfast" | "lunch" | "snack" | "dinner";
      suggestions: string[];
    }>;
  }>;
  workoutDays: Array<{
    day: number;
    focus: string;
    activities: Array<{ name: string; minutes: number; guidance: string }>;
  }> | null;
  generatedAt: string;
  exerciseCleared: boolean;
  notice: string;
  workoutNotice: string | null;
};
type ReportSummary = {
  reportId: string;
  summary: string;
  note: string;
  provider: string;
};
type CoachMessage = {
  role: "user" | "assistant";
  content: string;
};
type Measurement = {
  measured_on: string;
  weight_kg: string;
  body_fat_percent: string | null;
};
type StrengthRecord = {
  exercise_name: string;
  performed_at: string;
  weight_kg: string;
  repetitions: number;
};
type Totals = {
  calories: number;
  proteinG: number;
  carbohydratesG: number;
  fatG: number;
  fiberG: number;
  sodiumMg: number;
  calciumMg: number;
  ironMg: number;
  potassiumMg: number;
  magnesiumMg: number;
};
type FoodEstimate = {
  caloriesPer100: number;
  proteinPer100: number;
  carbohydratesPer100: number;
  fatPer100: number;
  fiberPer100: number;
  sodiumMgPer100: number;
  calciumMgPer100: number;
  ironMgPer100: number;
  potassiumMgPer100: number;
  magnesiumMgPer100: number;
  provider: string;
  model: string;
  sourceLabel: string;
};
type FoodNutritionFields = Omit<
  FoodEstimate,
  "provider" | "model" | "sourceLabel"
>;
const emptyFoodValues: Record<keyof FoodNutritionFields, string> = {
  caloriesPer100: "",
  proteinPer100: "",
  carbohydratesPer100: "",
  fatPer100: "",
  fiberPer100: "",
  sodiumMgPer100: "",
  calciumMgPer100: "",
  ironMgPer100: "",
  potassiumMgPer100: "",
  magnesiumMgPer100: "",
};

const navigation: Array<{ id: Page; label: string; icon: string }> = [
  { id: "overview", label: "Overview", icon: "⌂" },
  { id: "plans", label: "Training plans", icon: "↗" },
  { id: "exercises", label: "Exercises", icon: "◈" },
  { id: "nutrition", label: "Nutrition log", icon: "◉" },
  { id: "activity", label: "Activity & sleep", icon: "☼" },
  { id: "wellness", label: "My wellness", icon: "✚" },
  { id: "progress", label: "Progress", icon: "⌁" },
  { id: "assistant", label: "AI coach", icon: "✳" },
];

class RequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let refreshPromise: Promise<Session | null> | null = null;

function refreshSession(): Promise<Session | null> {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/v1/auth/refresh", {
      method: "POST",
      credentials: "include",
    })
      .then(async (response) => {
        if (response.status === 204) return null;
        if (!response.ok) return null;
        const payload = (await readResponse<
          ApiResponse<{ user: User; accessToken: string }>
        >(response)) as ApiResponse<{ user: User; accessToken: string }>;
        return {
          user: payload.data.user,
          accessToken: payload.data.accessToken,
        };
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function readResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const result = (await response.json()) as {
    data?: T;
    error?: { message?: string };
    success?: boolean;
  };
  if (!response.ok) {
    throw new RequestError(
      result.error?.message ?? "The request could not be completed.",
      response.status,
    );
  }
  return result as T;
}

function formatNumber(value: number | string | null | undefined, digits = 1) {
  if (value === null || value === undefined || value === "") return "—";
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString(undefined, { maximumFractionDigits: digits })
    : "—";
}

const poundsPerKilogram = 2.2046226218;

function displayWeight(kilograms: number, units: "metric" | "imperial") {
  return formatNumber(
    units === "imperial" ? kilograms * poundsPerKilogram : kilograms,
  );
}

function weightInKilograms(value: number, units: "metric" | "imperial") {
  return units === "imperial" ? value / poundsPerKilogram : value;
}

function weightInDisplayUnits(kilograms: number, units: "metric" | "imperial") {
  return units === "imperial" ? kilograms * poundsPerKilogram : kilograms;
}

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateOnly(value: string) {
  return value.slice(0, 10);
}

function localDateAtNoon(value: string) {
  return new Date(`${dateOnly(value)}T12:00:00`);
}

function useAuthenticatedRequest(
  session: Session | null,
  setSession: (value: Session | null) => void,
) {
  return useCallback(
    async (path: string, init: RequestInit = {}): Promise<Response> => {
      const send = (token?: string) => {
        const headers = new Headers(init.headers);
        if (init.body && !headers.has("content-type")) {
          headers.set("content-type", "application/json");
        }
        if (token) headers.set("authorization", `Bearer ${token}`);
        return fetch(path, { ...init, headers, credentials: "include" });
      };

      let response = await send(session?.accessToken);
      if (response.status === 401 && session) {
        const nextSession = await refreshSession();
        if (nextSession) {
          setSession(nextSession);
          response = await send(nextSession.accessToken);
        } else {
          setSession(null);
        }
      }
      return response;
    },
    [session, setSession],
  );
}

function useApi(
  session: Session | null,
  setSession: (value: Session | null) => void,
) {
  const request = useAuthenticatedRequest(session, setSession);
  return useCallback(
    async <T,>(path: string, init: RequestInit = {}): Promise<T> =>
      readResponse<T>(await request(path, init)),
    [request],
  );
}

function useApiStream(
  session: Session | null,
  setSession: (value: Session | null) => void,
) {
  const request = useAuthenticatedRequest(session, setSession);
  return useCallback(
    async (path: string, init: RequestInit = {}): Promise<Response> => {
      const response = await request(path, init);
      if (!response.ok) await readResponse(response);
      return response;
    },
    [request],
  );
}

function BrandMark() {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 14v12m4-16v20m8-20v20m4-16v12M16 20h8"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GymArrivalScene() {
  return (
    <svg
      className="gym-arrival-art"
      viewBox="0 0 640 360"
      role="img"
      aria-label="An animated barbell in a softly lit gym"
    >
      <defs>
        <linearGradient id="gym-wall" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#284a40" />
          <stop offset="1" stopColor="#142b26" />
        </linearGradient>
        <linearGradient id="gym-steel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f1c7a6" />
          <stop offset="1" stopColor="#d77658" />
        </linearGradient>
        <linearGradient id="gym-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#355b4d" />
          <stop offset="1" stopColor="#1c392f" />
        </linearGradient>
        <radialGradient id="gym-glow">
          <stop offset="0" stopColor="#e6a47e" stopOpacity=".3" />
          <stop offset="1" stopColor="#e6a47e" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect
        x="34"
        y="24"
        width="572"
        height="300"
        rx="28"
        fill="url(#gym-wall)"
      />
      <circle cx="320" cy="158" r="190" fill="url(#gym-glow)" />
      <path
        d="M34 238h572v58a28 28 0 0 1-28 28H62a28 28 0 0 1-28-28z"
        fill="url(#gym-floor)"
      />
      <path d="M78 80h100v104H78z" fill="#d9e9d8" fillOpacity=".08" />
      <path
        d="M128 80v104m-50-52h100"
        stroke="#d9e9d8"
        strokeOpacity=".1"
        strokeWidth="3"
      />
      <path
        d="M216 250V102m208 148V102m-208 22h208m-208 36h208"
        stroke="#8eb39a"
        strokeOpacity=".3"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        d="M233 252V113m174 139V113"
        stroke="#a9c5ac"
        strokeOpacity=".55"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <ellipse
        cx="320"
        cy="264"
        rx="180"
        ry="24"
        fill="#0c201a"
        fillOpacity=".35"
      />
      <g className="gym-bench">
        <path
          d="m300 231-20 38m92-38 20 38"
          stroke="#d1b49c"
          strokeOpacity=".8"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M279 220h120a10 10 0 0 1 10 10v12H269v-12a10 10 0 0 1 10-10z"
          fill="#d67658"
        />
        <path
          d="M283 224h112"
          stroke="#f3b18d"
          strokeOpacity=".65"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
      <g className="gym-barbell">
        <path
          d="M199 174h242"
          stroke="#dce8d9"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M217 147v54m14-66v78m178-78v78m14-66v54"
          stroke="url(#gym-steel)"
          strokeWidth="15"
          strokeLinecap="round"
        />
        <path
          d="M245 174h150"
          stroke="#fff1df"
          strokeOpacity=".42"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
      <g className="gym-dumbbell">
        <path
          d="M470 240h90"
          stroke="#f2d6c3"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M479 226v28m11-35v42m41-42v42m11-35v28"
          stroke="url(#gym-steel)"
          strokeWidth="8"
          strokeLinecap="round"
        />
      </g>
      <circle
        className="gym-spark gym-spark-one"
        cx="490"
        cy="100"
        r="4"
        fill="#f3bd98"
      />
      <circle
        className="gym-spark gym-spark-two"
        cx="540"
        cy="140"
        r="3"
        fill="#d9e8d6"
      />
      <circle
        className="gym-spark gym-spark-three"
        cx="140"
        cy="216"
        r="3"
        fill="#f3bd98"
      />
    </svg>
  );
}

function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: (session: Session) => void;
}) {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const fields = new FormData(event.currentTarget);
    try {
      const response = await fetch(
        `/api/v1/auth/${register ? "register" : "login"}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            email: fields.get("email"),
            password: fields.get("password"),
          }),
        },
      );
      const payload = (await readResponse<
        ApiResponse<{ user: User; accessToken: string }>
      >(response)) as ApiResponse<{ user: User; accessToken: string }>;
      onAuthenticated({
        user: payload.data.user,
        accessToken: payload.data.accessToken,
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to sign in. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="landing">
      <header className="public-header">
        <a className="brand" href="/" aria-label="FITFORGE home">
          <BrandMark /> FITFORGE
        </a>
        <span className="eyebrow">TRAINING, WITH INTENTION</span>
      </header>
      <section className="landing-content">
        <div className="landing-copy">
          <p className="eyebrow">YOUR TRAINING, CLEARLY TRACKED</p>
          <h1>
            Build strength.
            <br />
            See what changes.
          </h1>
          <p className="landing-description">
            A thoughtful space for your workouts, food log, and progress — built
            around what you actually record.
          </p>
          <div className="feature-list">
            <span>
              <b>01</b> Training plans &amp; exercise library
            </span>
            <span>
              <b>02</b> Food log with transparent sources
            </span>
            <span>
              <b>03</b> Progress from your own measurements
            </span>
          </div>
          <p className="honesty-note">
            No invented metrics. Your history stays yours.
          </p>
        </div>
        <div className="welcome-scene" aria-hidden="true">
          <div className="scene-orbit scene-orbit-back" />
          <div className="scene-orbit scene-orbit-front" />
          <div className="scene-stage">
            <div className="scene-dumbbell">
              <span className="dumbbell-plate plate-left" />
              <span className="dumbbell-bar" />
              <span className="dumbbell-plate plate-right" />
            </div>
          </div>
          <div className="scene-card scene-card-top">
            <span className="scene-sparkle">✳</span>
            <span>
              <b>YOUR PACE</b>
              <small>is the right pace</small>
            </span>
          </div>
          <div className="scene-card scene-card-bottom">
            <span className="scene-mini-bars">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            <span>
              <b>Small steps.</b>
              <small>Real progress.</small>
            </span>
          </div>
          <span className="scene-floor" />
        </div>
        <form className="auth-card" onSubmit={submit}>
          <div>
            <p className="eyebrow">
              {register ? "GET STARTED" : "WELCOME BACK"}
            </p>
            <h2>{register ? "Create your account" : "Sign in"}</h2>
            <p className="muted">
              {register
                ? "Start with your training and nutrition log."
                : "Pick up where your training left off."}
            </p>
          </div>
          <label>
            Email address
            <input
              autoComplete="email"
              name="email"
              type="email"
              required
              maxLength={254}
            />
          </label>
          <label>
            Password
            <input
              autoComplete={register ? "new-password" : "current-password"}
              name="password"
              type="password"
              required
              minLength={register ? 12 : 1}
              maxLength={72}
            />
            {register && <small>Use at least 12 characters.</small>}
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary full" disabled={busy}>
            {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
          </button>
          <p className="switch-auth">
            {register ? "Already have an account?" : "New to FITFORGE?"}{" "}
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setRegister(!register);
                setError("");
              }}
            >
              {register ? "Sign in" : "Create an account"}
            </button>
          </p>
        </form>
      </section>
      <footer className="landing-footer">
        <span>FITFORGE · A personal training log</span>
        <span>Food values are user-entered and source-labelled.</span>
      </footer>
    </main>
  );
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [page, setPage] = useState<Page>("overview");
  const [welcomeAnimation, setWelcomeAnimation] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [displayDate] = useState(() => new Date());
  const api = useApi(session, setSession);
  const apiStream = useApiStream(session, setSession);

  useEffect(() => {
    if (!welcomeAnimation) return;
    const timer = window.setTimeout(() => setWelcomeAnimation(false), 1900);
    return () => window.clearTimeout(timer);
  }, [welcomeAnimation]);

  useEffect(() => {
    let active = true;
    refreshSession()
      .then((refreshed) => {
        if (active && refreshed) setSession(refreshed);
      })
      .catch(() => {
        if (active)
          setSessionError(
            "Could not reach FITFORGE. Check your connection and try again.",
          );
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    try {
      const response = await fetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        setSessionError(
          "Your local session was cleared, but the server could not confirm refresh-token revocation.",
        );
      }
    } catch {
      setSessionError(
        "Your local session was cleared, but the server could not confirm refresh-token revocation.",
      );
    } finally {
      setSession(null);
      setPage("overview");
    }
  }

  if (checkingSession) {
    return (
      <main className="boot-screen">
        <BrandMark />
        <p>Opening your training log…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <>
        {sessionError && (
          <div className="connection-banner" role="alert">
            {sessionError}
          </div>
        )}
        <AuthScreen
          onAuthenticated={(nextSession) => {
            setSession(nextSession);
            setSessionError("");
            if (
              !window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ) {
              setWelcomeAnimation(true);
            }
          }}
        />
      </>
    );
  }

  return (
    <>
      <div className="app-shell">
        <aside className="sidebar">
          <a
            className="brand"
            href="#"
            onClick={(event) => {
              event.preventDefault();
              setPage("overview");
            }}
          >
            <BrandMark /> FITFORGE
          </a>
          <p className="nav-label">YOUR SPACE</p>
          <nav aria-label="Main navigation">
            {navigation.map((item) => (
              <button
                className={`nav-item ${page === item.id ? "active" : ""}`}
                key={item.id}
                onClick={() => setPage(item.id)}
              >
                <span className="nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <button className="account-link" onClick={() => setPage("account")}>
              <span className="avatar">
                {session.user.email[0]?.toUpperCase()}
              </span>
              <span className="account-text">
                <b>{session.user.email.split("@")[0]}</b>
                <small>Personal account</small>
              </span>
              <span aria-hidden="true">···</span>
            </button>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <span className="mobile-brand">
              <BrandMark /> FITFORGE
            </span>
            <span className="topbar-date">
              {displayDate.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </span>
            <button
              className="avatar avatar-button"
              aria-label="Open account"
              onClick={() => setPage("account")}
            >
              {session.user.email[0]?.toUpperCase()}
            </button>
          </header>
          <main className="main-content">
            <div className="page-transition" key={page}>
              {page === "overview" && (
                <Dashboard api={api} onNavigate={setPage} user={session.user} />
              )}
              {page === "plans" && <Plans api={api} />}
              {page === "exercises" && <ExerciseLibrary api={api} />}
              {page === "nutrition" && <Nutrition api={api} />}
              {page === "activity" && <ActivitySleep api={api} />}
              {page === "wellness" && <Wellness api={api} />}
              {page === "progress" && <Progress api={api} />}
              {page === "assistant" && <AiCoach apiStream={apiStream} />}
              {page === "account" && (
                <Account api={api} user={session.user} onLogout={logout} />
              )}
            </div>
          </main>
        </div>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navigation.map((item) => (
            <button
              className={page === item.id ? "active" : ""}
              key={item.id}
              onClick={() => setPage(item.id)}
            >
              <span aria-hidden="true">{item.icon}</span>
              <small>{item.label.split(" ")[0]}</small>
            </button>
          ))}
        </nav>
      </div>
      {welcomeAnimation && (
        <section
          className="login-welcome"
          role="status"
          aria-live="polite"
          aria-label="Welcome to FITFORGE"
        >
          <div className="login-welcome-content">
            <BrandMark />
            <p className="eyebrow">YOUR TRAINING FLOOR IS READY</p>
            <h1>Let’s get stronger, one day at a time.</h1>
            <GymArrivalScene />
            <button
              className="login-welcome-skip"
              onClick={() => setWelcomeAnimation(false)}
            >
              Skip intro
            </button>
          </div>
        </section>
      )}
    </>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

function Notice({
  children,
  onRetry,
}: {
  children: React.ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div className="notice" role="status">
      <span>{children}</span>
      {onRetry && (
        <button className="text-button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

function Dashboard({
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

function WeeklyActivityTracker({
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

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="stat-card">
      <p className="eyebrow">{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

function Empty({
  text,
  action,
  onClick,
}: {
  text: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="empty-state">
      <p>{text}</p>
      <button className="text-button" onClick={onClick}>
        {action} →
      </button>
    </div>
  );
}

function ExerciseLibrary({
  api,
}: {
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
}) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const result = await api<ApiResponse<Exercise[]>>(
        "/api/v1/exercises?limit=100",
      );
      setExercises(result.data);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Exercises could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => {
    void load();
  }, [load]);
  const shown = exercises.filter((exercise) =>
    `${exercise.name} ${exercise.muscleGroups.join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <>
      <PageHeading
        eyebrow="MOVE WITH PURPOSE"
        title="Exercise library"
        description="Browse movement details from the FITFORGE catalogue."
      />
      <div className="toolbar">
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Search exercises"
            placeholder="Search by movement or muscle"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <span className="muted">{shown.length} movements</span>
      </div>
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
      {loading ? (
        <p className="muted">Loading exercises…</p>
      ) : shown.length ? (
        <div className="exercise-grid">
          {shown.map((exercise) => (
            <article className="exercise-card" key={exercise._id}>
              <div className={`movement-chip ${exercise.movementType}`}>
                {exercise.movementType}
              </div>
              <div className="exercise-meta">
                {exercise.difficulty} ·{" "}
                {exercise.equipment.join(", ") || "No equipment listed"}
              </div>
              <h2>{exercise.name}</h2>
              <p>{exercise.description}</p>
              <div className="tag-row">
                {exercise.muscleGroups.map((muscle) => (
                  <span className="tag" key={muscle}>
                    {muscle}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="surface">
          <Empty
            text={
              search
                ? "No movements match that search."
                : "The exercise catalogue is empty right now."
            }
            action={search ? "Clear search" : "Try again"}
            onClick={() => (search ? setSearch("") : void load())}
          />
        </div>
      )}
    </>
  );
}

function Plans({
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

function Nutrition({
  api,
}: {
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
}) {
  const [foods, setFoods] = useState<Food[]>([]);
  const [logs, setLogs] = useState<NutritionLog[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [date, setDate] = useState(today);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [addingFood, setAddingFood] = useState(false);
  const [addingMeal, setAddingMeal] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState("breakfast");
  const [mealFoodId, setMealFoodId] = useState("");
  const [mealAmount, setMealAmount] = useState("100");
  const [foodName, setFoodName] = useState("");
  const [foodUnit, setFoodUnit] = useState<"g" | "ml">("g");
  const [foodSource, setFoodSource] = useState("");
  const [foodAiModel, setFoodAiModel] = useState("");
  const [estimateAvailable, setEstimateAvailable] = useState(false);
  const [foodValues, setFoodValues] = useState(emptyFoodValues);
  const mealSections = [
    { value: "breakfast", label: "Breakfast" },
    { value: "lunch", label: "Lunch" },
    { value: "dinner", label: "Dinner" },
    { value: "snack", label: "Snacks" },
  ];
  const selectedMealFood =
    foods.find((food) => food.id === mealFoodId) ?? foods[0];
  const mealAmountValue = Number(mealAmount);
  const mealNutritionPreview =
    selectedMealFood && Number.isFinite(mealAmountValue) && mealAmountValue > 0
      ? {
          calories:
            (Number(selectedMealFood.calories_per_100) * mealAmountValue) / 100,
          protein:
            (Number(selectedMealFood.protein_per_100) * mealAmountValue) / 100,
          carbohydrates:
            (Number(selectedMealFood.carbohydrates_per_100) * mealAmountValue) /
            100,
          fat: (Number(selectedMealFood.fat_per_100) * mealAmountValue) / 100,
        }
      : null;

  function clearAiEstimate() {
    if (!foodAiModel) return;
    setFoodValues(emptyFoodValues);
    setFoodSource("");
    setFoodAiModel("");
  }
  const loadFoods = useCallback(async () => {
    const response = await api<ApiResponse<Food[]>>("/api/v1/foods?limit=100");
    setFoods(response.data);
  }, [api]);
  const loadEstimateAvailability = useCallback(async () => {
    const response = await api<ApiResponse<{ available: boolean }>>(
      "/api/v1/foods/estimate",
    );
    setEstimateAvailable(response.data.available);
  }, [api]);
  const loadLogs = useCallback(async () => {
    const response = await api<ApiResponse<typeof logs>>(
      `/api/v1/nutrition/logs?date=${date}`,
    );
    setLogs(response.data);
    setTotals(response.total ?? null);
  }, [api, date]);
  const load = useCallback(async () => {
    try {
      await Promise.all([loadFoods(), loadLogs(), loadEstimateAvailability()]);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nutrition data could not be loaded.",
      );
    }
  }, [loadEstimateAvailability, loadFoods, loadLogs]);
  useEffect(() => {
    void load();
  }, [load]);

  async function saveFood(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/api/v1/foods", {
        method: "POST",
        body: JSON.stringify({
          name: foodName,
          servingUnit: foodUnit,
          caloriesPer100: Number(foodValues.caloriesPer100),
          proteinPer100: Number(foodValues.proteinPer100),
          carbohydratesPer100: Number(foodValues.carbohydratesPer100),
          fatPer100: Number(foodValues.fatPer100),
          fiberPer100: Number(foodValues.fiberPer100),
          sodiumMgPer100: Number(foodValues.sodiumMgPer100),
          calciumMgPer100: Number(foodValues.calciumMgPer100),
          ironMgPer100: Number(foodValues.ironMgPer100),
          potassiumMgPer100: Number(foodValues.potassiumMgPer100),
          magnesiumMgPer100: Number(foodValues.magnesiumMgPer100),
          sourceLabel: foodSource,
          sourceUrl: fields.get("sourceUrl") || undefined,
        }),
      });
      setAddingFood(false);
      setFoodName("");
      setFoodUnit("g");
      setFoodValues(emptyFoodValues);
      setFoodSource("");
      setFoodAiModel("");
      await loadFoods();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Food could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function estimateFood(form: HTMLFormElement | null) {
    if (!form) return;
    setEstimating(true);
    setError("");
    try {
      const response = await api<ApiResponse<FoodEstimate>>(
        "/api/v1/foods/estimate",
        {
          method: "POST",
          body: JSON.stringify({
            name: foodName,
            servingUnit: foodUnit,
          }),
        },
      );
      setFoodValues({
        caloriesPer100: String(response.data.caloriesPer100),
        proteinPer100: String(response.data.proteinPer100),
        carbohydratesPer100: String(response.data.carbohydratesPer100),
        fatPer100: String(response.data.fatPer100),
        fiberPer100: String(response.data.fiberPer100),
        sodiumMgPer100: String(response.data.sodiumMgPer100),
        calciumMgPer100: String(response.data.calciumMgPer100),
        ironMgPer100: String(response.data.ironMgPer100),
        potassiumMgPer100: String(response.data.potassiumMgPer100),
        magnesiumMgPer100: String(response.data.magnesiumMgPer100),
      });
      setFoodSource(response.data.sourceLabel);
      setFoodAiModel(response.data.model);
    } catch (estimateError) {
      setError(
        estimateError instanceof Error
          ? estimateError.message
          : "Nutrition could not be estimated.",
      );
    } finally {
      setEstimating(false);
    }
  }

  async function saveMeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/api/v1/nutrition/logs", {
        method: "POST",
        body: JSON.stringify({
          date,
          mealType: fields.get("mealType"),
          items: [
            {
              foodId: fields.get("foodId"),
              servingAmount: Number(fields.get("amount")),
            },
          ],
        }),
      });
      setAddingMeal(false);
      await loadLogs();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Meal could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  function openMealForm(mealType = "breakfast") {
    setSelectedMealType(mealType);
    setAddingMeal(true);
    setAddingFood(false);
  }

  async function removeMeal(logId: string) {
    if (!window.confirm("Remove this meal from your log?")) return;
    setError("");
    try {
      await api(`/api/v1/nutrition/logs/${logId}`, { method: "DELETE" });
      await loadLogs();
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Meal could not be removed.",
      );
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="EAT, LOG, UNDERSTAND"
        title="Nutrition log"
        description="Your daily totals come from foods and serving amounts you enter."
        action={
          <label className="date-control">
            LOG DATE
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
        }
      />
      {error && <Notice onRetry={() => void load()}>{error}</Notice>}
      <div className="macro-grid">
        <Stat
          label="CALORIES"
          value={totals ? `${formatNumber(totals.calories, 0)} kcal` : "—"}
          detail="Logged meals only"
        />
        <Stat
          label="PROTEIN"
          value={totals ? `${formatNumber(totals.proteinG)} g` : "—"}
          detail="From your food records"
        />
        <Stat
          label="CARBOHYDRATES"
          value={totals ? `${formatNumber(totals.carbohydratesG)} g` : "—"}
          detail="From your food records"
        />
        <Stat
          label="FAT"
          value={totals ? `${formatNumber(totals.fatG)} g` : "—"}
          detail="From your food records"
        />
      </div>
      <p className="small-note">
        Minerals
        {totals
          ? ` · Calcium ${formatNumber(totals.calciumMg)} mg · Iron ${formatNumber(totals.ironMg)} mg · Potassium ${formatNumber(totals.potassiumMg)} mg · Magnesium ${formatNumber(totals.magnesiumMg)} mg`
          : " · Log a meal to see daily totals"}
      </p>
      <div className="toolbar action-toolbar">
        <p className="muted">
          {foods.length} personal food{foods.length === 1 ? "" : "s"} in your
          library
        </p>
        <div>
          <button
            className="button secondary"
            onClick={() => {
              setAddingFood(!addingFood);
              setAddingMeal(false);
            }}
          >
            + Add food
          </button>
          <button
            className="button primary"
            disabled={!foods.length}
            onClick={() => (addingMeal ? setAddingMeal(false) : openMealForm())}
          >
            + Log meal
          </button>
        </div>
      </div>
      {addingFood && (
        <form className="surface form-surface" onSubmit={saveFood}>
          <p className="eyebrow">YOUR FOOD · VALUES PER 100 G / ML</p>
          <p className="muted">
            Add the food name and use the AI estimator to fill typical values
            per 100 g/ml, or enter values from a trusted label. AI values are
            estimates; check them before saving.
          </p>
          <div className="toolbar">
            <button
              className="button secondary"
              type="button"
              disabled={estimating || busy || !foodName.trim()}
              onClick={(event) => void estimateFood(event.currentTarget.form)}
            >
              {estimating ? "Estimating…" : "Estimate nutrition locally"}
            </button>
            <span className="small-note">
              {!estimateAvailable
                ? "Free local AI is starting or its model is missing. Check the Ollama model download; you can enter values manually."
                : foodAiModel
                  ? `Estimated locally with Ollama ${foodAiModel}`
                  : "Free local AI · Ollama"}
            </span>
          </div>
          <div className="form-grid">
            <label>
              Food name
              <input
                name="name"
                maxLength={120}
                value={foodName}
                disabled={estimating}
                onChange={(event) => {
                  clearAiEstimate();
                  setFoodName(event.target.value);
                }}
                required
              />
            </label>
            <label>
              Unit
              <select
                name="servingUnit"
                value={foodUnit}
                disabled={estimating}
                onChange={(event) => {
                  clearAiEstimate();
                  setFoodUnit(event.target.value === "ml" ? "ml" : "g");
                }}
              >
                <option value="g">grams (g)</option>
                <option value="ml">millilitres (ml)</option>
              </select>
            </label>
            <label>
              Calories
              <input
                name="calories"
                type="number"
                min="0"
                max="1000"
                step="0.01"
                value={foodValues.caloriesPer100}
                onChange={(event) =>
                  setFoodValues({
                    ...foodValues,
                    caloriesPer100: event.target.value,
                  })
                }
                required
              />
            </label>
            <label>
              Protein (g)
              <input
                name="protein"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={foodValues.proteinPer100}
                onChange={(event) =>
                  setFoodValues({
                    ...foodValues,
                    proteinPer100: event.target.value,
                  })
                }
                required
              />
            </label>
            <label>
              Carbohydrates (g)
              <input
                name="carbohydrates"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={foodValues.carbohydratesPer100}
                onChange={(event) =>
                  setFoodValues({
                    ...foodValues,
                    carbohydratesPer100: event.target.value,
                  })
                }
                required
              />
            </label>
            <label>
              Fat (g)
              <input
                name="fat"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={foodValues.fatPer100}
                onChange={(event) =>
                  setFoodValues({
                    ...foodValues,
                    fatPer100: event.target.value,
                  })
                }
                required
              />
            </label>
            <label>
              Fiber (g)
              <input
                name="fiber"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={foodValues.fiberPer100}
                onChange={(event) =>
                  setFoodValues({
                    ...foodValues,
                    fiberPer100: event.target.value,
                  })
                }
                required
              />
            </label>
            <label>
              Sodium (mg)
              <input
                name="sodium"
                type="number"
                min="0"
                max="100000"
                step="0.01"
                value={foodValues.sodiumMgPer100}
                onChange={(event) =>
                  setFoodValues({
                    ...foodValues,
                    sodiumMgPer100: event.target.value,
                  })
                }
                required
              />
            </label>
            <label>
              Calcium (mg)
              <input
                name="calcium"
                type="number"
                min="0"
                max="100000"
                step="0.01"
                value={foodValues.calciumMgPer100}
                onChange={(event) =>
                  setFoodValues({
                    ...foodValues,
                    calciumMgPer100: event.target.value,
                  })
                }
                required
              />
            </label>
            <label>
              Iron (mg)
              <input
                name="iron"
                type="number"
                min="0"
                max="10000"
                step="0.01"
                value={foodValues.ironMgPer100}
                onChange={(event) =>
                  setFoodValues({
                    ...foodValues,
                    ironMgPer100: event.target.value,
                  })
                }
                required
              />
            </label>
            <label>
              Potassium (mg)
              <input
                name="potassium"
                type="number"
                min="0"
                max="100000"
                step="0.01"
                value={foodValues.potassiumMgPer100}
                onChange={(event) =>
                  setFoodValues({
                    ...foodValues,
                    potassiumMgPer100: event.target.value,
                  })
                }
                required
              />
            </label>
            <label>
              Magnesium (mg)
              <input
                name="magnesium"
                type="number"
                min="0"
                max="100000"
                step="0.01"
                value={foodValues.magnesiumMgPer100}
                onChange={(event) =>
                  setFoodValues({
                    ...foodValues,
                    magnesiumMgPer100: event.target.value,
                  })
                }
                required
              />
            </label>
            <label>
              Source label
              <input
                name="source"
                maxLength={200}
                placeholder="e.g. package nutrition label"
                value={foodSource}
                onChange={(event) => setFoodSource(event.target.value)}
                required
              />
            </label>
            <label>
              Source URL (optional)
              <input name="sourceUrl" type="url" maxLength={2048} />
            </label>
          </div>
          <button className="button primary" disabled={busy || estimating}>
            {busy ? "Saving…" : "Save food"}
          </button>
        </form>
      )}
      {addingMeal && (
        <form className="surface form-surface" onSubmit={saveMeal}>
          <p className="eyebrow">LOG A MEAL FOR {date}</p>
          <p className="muted">
            Enter how much you actually ate. Nutrition totals are scaled to your
            consumed amount.
          </p>
          <div className="form-grid">
            <label>
              Meal
              <select
                name="mealType"
                value={selectedMealType}
                onChange={(event) => setSelectedMealType(event.target.value)}
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snack</option>
              </select>
            </label>
            <label>
              Food
              <select
                name="foodId"
                value={selectedMealFood?.id ?? ""}
                onChange={(event) => setMealFoodId(event.target.value)}
                required
              >
                {foods.map((food) => (
                  <option key={food.id} value={food.id}>
                    {food.name} · {food.source_label}
                  </option>
                ))}
              </select>
            </label>{" "}
            <label>
              Amount consumed
              <span className="quantity-input">
                <input
                  name="amount"
                  type="number"
                  min="0.1"
                  max="10000"
                  step="0.1"
                  value={mealAmount}
                  onChange={(event) => setMealAmount(event.target.value)}
                  aria-label={`Amount consumed in ${selectedMealFood?.serving_unit ?? "g"}`}
                  required
                />
                <span className="quantity-unit">
                  {selectedMealFood?.serving_unit ?? "g"}
                </span>
              </span>
            </label>
          </div>
          <p className="small-note" aria-live="polite">
            {mealNutritionPreview && selectedMealFood
              ? `For ${formatNumber(mealAmountValue)} ${selectedMealFood.serving_unit}: ${formatNumber(mealNutritionPreview.calories, 0)} kcal · ${formatNumber(mealNutritionPreview.protein)} g protein · ${formatNumber(mealNutritionPreview.carbohydrates)} g carbs · ${formatNumber(mealNutritionPreview.fat)} g fat`
              : "Enter a consumed amount greater than zero to preview nutrition."}
          </p>
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : "Save meal"}
          </button>
        </form>
      )}
      <section className="surface meals-surface">
        <div className="section-heading">
          <div>
            <p className="eyebrow">MEALS ON {date}</p>
            <h2>Food log</h2>
          </div>
          <span className="muted">
            {logs.length} meal entr{logs.length === 1 ? "y" : "ies"}
          </span>
        </div>
        {mealSections.map((section) => {
          const sectionLogs = logs.filter(
            (log) => log.meal_type === section.value,
          );
          const sectionItems = sectionLogs.flatMap((log) =>
            log.items.map((item, index) => ({
              ...item,
              logId: log.id,
              key: `${log.id}-${item.foodName}-${index}`,
            })),
          );
          const sectionCalories = sectionItems.reduce(
            (sum, item) => sum + Number(item.calories),
            0,
          );
          const sectionProtein = sectionItems.reduce(
            (sum, item) => sum + Number(item.proteinG),
            0,
          );
          const sectionCarbs = sectionItems.reduce(
            (sum, item) => sum + Number(item.carbohydratesG),
            0,
          );
          return (
            <section className="meal-section" key={section.value}>
              <div className="meal-section-heading">
                <div>
                  <h3>{section.label}</h3>
                  <span className="muted">
                    {sectionItems.length
                      ? `${formatNumber(sectionCalories, 0)} kcal · ${formatNumber(sectionProtein)} g protein · ${formatNumber(sectionCarbs)} g carbs`
                      : "Nothing logged yet"}
                  </span>
                </div>
                <button
                  className="button secondary"
                  disabled={!foods.length}
                  onClick={() => openMealForm(section.value)}
                >
                  + Add food
                </button>
              </div>
              {sectionItems.map((item) => (
                <article className="meal-row" key={item.key}>
                  <div className="meal-entry">
                    <b>{item.foodName}</b>
                    <p className="muted">
                      {formatNumber(item.servingAmount)} {item.servingUnit} ·{" "}
                      {item.source}
                    </p>
                  </div>
                  <span className="meal-calories">
                    {formatNumber(Number(item.calories), 0)} kcal
                  </span>
                  <button
                    className="icon-button danger-text"
                    aria-label={`Remove ${section.label} entry: ${item.foodName}`}
                    onClick={() => void removeMeal(item.logId)}
                  >
                    ×
                  </button>
                </article>
              ))}
            </section>
          );
        })}
        {!logs.length && !foods.length && (
          <p className="small-note">
            Add foods to your library first, then log them under a meal.
          </p>
        )}
      </section>
      <p className="small-note">
        Nutrition totals are arithmetic from your entered food values, not
        dietary guidance.
      </p>
    </>
  );
}

function chartDayLabel(value: string) {
  return localDateAtNoon(value).toLocaleDateString(undefined, {
    weekday: "short",
  });
}

function ActivityMinutesChart({ data }: { data: ActivityProgressDay[] }) {
  const width = 700;
  const height = 270;
  const x = scaleLinear()
    .domain([0, Math.max(data.length - 1, 1)])
    .range([72, width - 32]);
  const maxMinutes = max(data, (entry) => Number(entry.activity_minutes)) ?? 0;
  const y = scaleLinear()
    .domain([0, Math.max(maxMinutes, 60)])
    .nice(4)
    .range([height - 42, 30]);
  const barWidth = Math.min(42, (width - 104) / Math.max(data.length, 1) / 2);

  return (
    <article className="surface activity-chart-card">
      <div className="activity-chart-heading">
        <div>
          <p className="eyebrow">MOVEMENT</p>
          <h3>Active minutes</h3>
        </div>
        <span className="chart-legend">
          <i className="activity-legend-mark" /> Activity
        </span>
      </div>
      <svg
        className="activity-chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Bar chart showing activity minutes by day for the last seven days"
      >
        <defs>
          <linearGradient
            id="activity-bar-gradient"
            x1="0"
            x2="0"
            y1="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#e97555" />
            <stop offset="100%" stopColor="#b74732" />
          </linearGradient>
          <linearGradient id="activity-bar-side-gradient" x1="0" x2="1">
            <stop offset="0%" stopColor="#983b2d" />
            <stop offset="100%" stopColor="#7f3027" />
          </linearGradient>
          <linearGradient
            id="activity-bar-top-gradient"
            x1="0"
            x2="0"
            y1="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#f8a17e" />
            <stop offset="100%" stopColor="#df684a" />
          </linearGradient>
        </defs>
        {y.ticks(4).map((tick) => (
          <g key={tick}>
            <line
              className="activity-chart-gridline"
              x1={56}
              x2={width - 20}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text className="activity-chart-axis" x={48} y={y(tick) + 4}>
              {tick}
            </text>
          </g>
        ))}
        {data.map((entry, index) => {
          const minutes = Number(entry.activity_minutes);
          const barHeight = Math.max(0, y(0) - y(minutes));
          const xPosition = x(index) - barWidth / 2;
          const depth = Math.min(7, barWidth * 0.22);
          return (
            <g key={entry.summary_date}>
              {barHeight > 0 && (
                <>
                  <polygon
                    className="activity-chart-bar-side"
                    points={`${xPosition + barWidth},${y(minutes)} ${xPosition + barWidth + depth},${y(minutes) - depth} ${xPosition + barWidth + depth},${y(0) - depth} ${xPosition + barWidth},${y(0)}`}
                  />
                  <polygon
                    className="activity-chart-bar-top"
                    points={`${xPosition},${y(minutes)} ${xPosition + depth},${y(minutes) - depth} ${xPosition + barWidth + depth},${y(minutes) - depth} ${xPosition + barWidth},${y(minutes)}`}
                  />
                </>
              )}
              <rect
                className="activity-chart-bar"
                x={xPosition}
                y={y(minutes)}
                width={barWidth}
                height={barHeight}
                rx={barWidth / 2}
                fill="url(#activity-bar-gradient)"
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <title>{`${chartDayLabel(entry.summary_date)}: ${minutes} active minutes`}</title>
              </rect>
              {minutes > 0 && (
                <text
                  className="activity-chart-value"
                  x={x(index)}
                  y={y(minutes) - 9}
                  textAnchor="middle"
                >
                  {minutes}
                </text>
              )}
              <text
                className="activity-chart-day"
                x={x(index)}
                y={height - 14}
                textAnchor="middle"
              >
                {chartDayLabel(entry.summary_date)}
              </text>
            </g>
          );
        })}
      </svg>
    </article>
  );
}

function SleepTrendChart({ data }: { data: ActivityProgressDay[] }) {
  const width = 700;
  const height = 270;
  const x = scaleLinear()
    .domain([0, Math.max(data.length - 1, 1)])
    .range([72, width - 32]);
  const maxSleepHours =
    max(data, (entry) => Number(entry.sleep_minutes) / 60) ?? 0;
  const y = scaleLinear()
    .domain([0, Math.max(maxSleepHours, 8)])
    .nice(4)
    .range([height - 42, 30]);
  const sleepLine = line<ActivityProgressDay>()
    .defined((entry) => Number(entry.sleep_count) > 0)
    .x((_entry, index) => x(index))
    .y((entry) => y(Number(entry.sleep_minutes) / 60))
    .curve(curveMonotoneX);

  return (
    <article className="surface activity-chart-card">
      <div className="activity-chart-heading">
        <div>
          <p className="eyebrow">REST</p>
          <h3>Sleep duration</h3>
        </div>
        <span className="chart-legend">
          <i className="sleep-legend-mark" /> Sleep
        </span>
      </div>
      <svg
        className="activity-chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Line chart showing sleep hours by night for the last seven days"
      >
        {y.ticks(4).map((tick) => (
          <g key={tick}>
            <line
              className="activity-chart-gridline"
              x1={56}
              x2={width - 20}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text className="activity-chart-axis" x={48} y={y(tick) + 4}>
              {tick}h
            </text>
          </g>
        ))}
        <path className="sleep-chart-line-depth" d={sleepLine(data) ?? ""} />
        <path className="sleep-chart-line" d={sleepLine(data) ?? ""} />
        {data.map((entry, index) => {
          const sleepHours = Number(entry.sleep_minutes) / 60;
          const hasSleep = Number(entry.sleep_count) > 0;
          return (
            <g key={entry.summary_date}>
              {hasSleep && (
                <>
                  <circle
                    className="sleep-chart-halo"
                    cx={x(index)}
                    cy={y(sleepHours)}
                    r={10}
                  />
                  <circle
                    className="sleep-chart-point"
                    cx={x(index)}
                    cy={y(sleepHours)}
                    r={4}
                  >
                    <title>{`${chartDayLabel(entry.summary_date)}: ${formatNumber(sleepHours)} hours of sleep`}</title>
                  </circle>
                  <text
                    className="activity-chart-value"
                    x={x(index)}
                    y={y(sleepHours) - 12}
                    textAnchor="middle"
                  >
                    {formatNumber(sleepHours)}h
                  </text>
                </>
              )}
              <text
                className="activity-chart-day"
                x={x(index)}
                y={height - 14}
                textAnchor="middle"
              >
                {chartDayLabel(entry.summary_date)}
              </text>
            </g>
          );
        })}
      </svg>
    </article>
  );
}

function ActivitySleep({
  api,
}: {
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
}) {
  const [date, setDate] = useState(today);
  const [day, setDay] = useState<ActivityDay>({
    activities: [],
    sleep: [],
    activityMinutes: 0,
    sleepMinutes: 0,
  });
  const [weeklyProgress, setWeeklyProgress] = useState<ActivityProgressDay[]>(
    [],
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const weekStart = addDays(date, -6);

  const loadDay = useCallback(async () => {
    try {
      const [dayResponse, weekResponse] = await Promise.all([
        api<ApiResponse<ActivityDay>>(`/api/v1/activity?date=${date}`),
        api<ApiResponse<ActivityProgressDay[]>>(
          `/api/v1/activity/summary?from=${weekStart}&to=${date}`,
        ),
      ]);
      setDay(dayResponse.data);
      setWeeklyProgress(weekResponse.data);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Activity and sleep records could not be loaded.",
      );
    }
  }, [api, date, weekStart]);

  useEffect(() => {
    void loadDay();
  }, [loadDay]);

  async function saveActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await api("/api/v1/activity/activities", {
        method: "POST",
        body: JSON.stringify({
          activityDate: date,
          activityTime: fields.get("activityTime"),
          activityType: fields.get("activityType"),
          durationMinutes: Number(fields.get("durationMinutes")),
          distanceKm: fields.get("distanceKm")
            ? Number(fields.get("distanceKm"))
            : undefined,
          note: fields.get("note") || undefined,
        }),
      });
      form.reset();
      await loadDay();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Activity could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveSleep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await api("/api/v1/activity/sleep", {
        method: "POST",
        body: JSON.stringify({
          sleepDate: date,
          bedtime: fields.get("bedtime"),
          wakeTime: fields.get("wakeTime"),
          note: fields.get("note") || undefined,
        }),
      });
      form.reset();
      await loadDay();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Sleep could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeRecord(path: string) {
    if (!window.confirm("Remove this record?")) return;
    setError("");
    try {
      await api(path, { method: "DELETE" });
      await loadDay();
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Record could not be removed.",
      );
    }
  }

  const durationLabel = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (!hours) return `${remainingMinutes} min`;
    return remainingMinutes
      ? `${hours} hr ${remainingMinutes} min`
      : `${hours} hr`;
  };

  return (
    <>
      <PageHeading
        eyebrow="YOUR DAY, YOUR WAY"
        title="Activity & sleep"
        description="Manually log movement and sleep to see how your day adds up."
        action={
          <label className="date-control">
            DAY
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
        }
      />
      {error && <Notice onRetry={() => void loadDay()}>{error}</Notice>}
      <div className="macro-grid">
        <Stat
          label="ACTIVITY"
          value={durationLabel(day.activityMinutes)}
          detail={`${day.activities.length} logged ${day.activities.length === 1 ? "activity" : "activities"}`}
        />
        <Stat
          label="SLEEP"
          value={durationLabel(day.sleepMinutes)}
          detail={`${day.sleep.length} sleep ${day.sleep.length === 1 ? "record" : "records"} · entered manually`}
        />
      </div>
      <p className="small-note">
        These are your manual entries, not automatic phone or wearable
        measurements.
      </p>
      <section className="activity-progress">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR LAST 7 DAYS</p>
            <h2>Progress at a glance</h2>
          </div>
          <span className="muted">
            {dateOnly(weekStart)} – {dateOnly(date)}
          </span>
        </div>
        <div className="activity-progress-summary">
          <div>
            <span className="eyebrow">ACTIVE TIME</span>
            <b>
              {durationLabel(
                weeklyProgress.reduce(
                  (sum, entry) => sum + Number(entry.activity_minutes),
                  0,
                ),
              )}
            </b>
          </div>
          <div>
            <span className="eyebrow">AVERAGE SLEEP</span>
            <b>
              {(() => {
                const recordedNights = weeklyProgress.filter(
                  (entry) => Number(entry.sleep_count) > 0,
                );
                const minutes = recordedNights.length
                  ? Math.round(
                      recordedNights.reduce(
                        (sum, entry) => sum + Number(entry.sleep_minutes),
                        0,
                      ) / recordedNights.length,
                    )
                  : 0;
                return recordedNights.length ? durationLabel(minutes) : "—";
              })()}
            </b>
          </div>
          <div>
            <span className="eyebrow">DISTANCE</span>
            <b>
              {formatNumber(
                weeklyProgress.reduce(
                  (sum, entry) => sum + Number(entry.distance_km),
                  0,
                ),
              )}{" "}
              km
            </b>
          </div>
        </div>
        <div className="activity-chart-grid">
          <ActivityMinutesChart
            key={`activity-${weekStart}-${date}`}
            data={weeklyProgress}
          />
          <SleepTrendChart
            key={`sleep-${weekStart}-${date}`}
            data={weeklyProgress}
          />
        </div>
        <p className="small-note activity-chart-note">
          Only days with manually recorded activity or sleep are shown in the
          trend lines.
        </p>
      </section>
      <div className="activity-forms">
        <form className="surface form-surface" onSubmit={saveActivity}>
          <p className="eyebrow">MOVEMENT · {date}</p>
          <h2>Log an activity</h2>
          <div className="stacked-fields">
            <label>
              Start time
              <input
                name="activityTime"
                type="time"
                defaultValue="12:00"
                required
              />
            </label>
            <label>
              Activity
              <select name="activityType" defaultValue="walking">
                <option value="walking">Walking</option>
                <option value="running">Running</option>
                <option value="cycling">Cycling</option>
                <option value="strength">Strength training</option>
                <option value="yoga">Yoga</option>
                <option value="other">Other</option>
              </select>
            </label>
            <div className="inline-fields">
              <label>
                Duration (minutes)
                <input
                  name="durationMinutes"
                  type="number"
                  min="1"
                  max="1440"
                  step="1"
                  placeholder="30"
                  required
                />
              </label>
              <label>
                Distance (km, optional)
                <input
                  name="distanceKm"
                  type="number"
                  min="0"
                  max="1000"
                  step="0.01"
                />
              </label>
            </div>
            <label>
              Note (optional)
              <input name="note" maxLength={500} placeholder="How did it go?" />
            </label>
          </div>
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : "Save activity"}
          </button>
        </form>
        <form className="surface form-surface" onSubmit={saveSleep}>
          <p className="eyebrow">REST · {date}</p>
          <h2>Log sleep</h2>
          <p className="muted">Choose the night that ended on this date.</p>
          <div className="stacked-fields">
            <div className="inline-fields">
              <label>
                Bedtime
                <input
                  name="bedtime"
                  type="time"
                  defaultValue="22:00"
                  required
                />
              </label>
              <label>
                Wake-up time
                <input
                  name="wakeTime"
                  type="time"
                  defaultValue="06:00"
                  required
                />
              </label>
            </div>
            <label>
              Note (optional)
              <input
                name="note"
                maxLength={500}
                placeholder="How did you sleep?"
              />
            </label>
          </div>
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : "Save sleep"}
          </button>
        </form>
      </div>
      <section className="surface activity-history">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR ENTRIES · {date}</p>
            <h2>Daily timeline</h2>
          </div>
        </div>
        <div className="meal-section">
          <div className="meal-section-heading">
            <div>
              <h3>Activities</h3>
              <span className="muted">
                {durationLabel(day.activityMinutes)} total
              </span>
            </div>
          </div>
          {day.activities.length ? (
            day.activities.map((activity) => (
              <article className="meal-row" key={activity.id}>
                <div className="meal-entry">
                  <b>
                    {activity.activity_type === "strength"
                      ? "Strength training"
                      : activity.activity_type}
                  </b>
                  <p className="muted">
                    {activity.activity_time.slice(0, 5)} ·{" "}
                    {durationLabel(Number(activity.duration_minutes))}
                    {activity.distance_km
                      ? ` · ${formatNumber(activity.distance_km)} km`
                      : ""}
                    {activity.note ? ` · ${activity.note}` : ""}
                  </p>
                </div>
                <span className="small-note">Manual</span>
                <button
                  className="icon-button danger-text"
                  aria-label={`Remove ${activity.activity_type} record`}
                  onClick={() =>
                    void removeRecord(
                      `/api/v1/activity/activities/${activity.id}`,
                    )
                  }
                >
                  ×
                </button>
              </article>
            ))
          ) : (
            <p className="small-note">No activities logged for this day.</p>
          )}
        </div>
        <div className="meal-section">
          <div className="meal-section-heading">
            <div>
              <h3>Sleep</h3>
              <span className="muted">
                {durationLabel(day.sleepMinutes)} total
              </span>
            </div>
          </div>
          {day.sleep.length ? (
            day.sleep.map((record) => (
              <article className="meal-row" key={record.id}>
                <div className="meal-entry">
                  <b>{durationLabel(Number(record.duration_minutes))}</b>
                  <p className="muted">
                    {record.bedtime.slice(0, 5)}–{record.wake_time.slice(0, 5)}
                    {record.note ? ` · ${record.note}` : ""}
                  </p>
                </div>
                <span className="small-note">Manual</span>
                <button
                  className="icon-button danger-text"
                  aria-label="Remove sleep record"
                  onClick={() =>
                    void removeRecord(`/api/v1/activity/sleep/${record.id}`)
                  }
                >
                  ×
                </button>
              </article>
            ))
          ) : (
            <p className="small-note">No sleep logged for this day.</p>
          )}
        </div>
      </section>
    </>
  );
}

function TrendChart({
  data,
  units,
}: {
  data: Measurement[];
  units: "metric" | "imperial";
}) {
  const filtered = data;
  if (!filtered.length)
    return (
      <div className="chart-empty">
        Add body measurements to see a trend here.
      </div>
    );
  const width = 680;
  const height = 240;
  const margin = { top: 18, right: 20, bottom: 38, left: 46 };
  const dates = filtered.map((row) => localDateAtNoon(row.measured_on));
  const values = filtered.map((row) =>
    weightInDisplayUnits(Number(row.weight_kg), units),
  );
  const dateExtent = extent(dates) as [Date, Date];
  if (dateExtent[0].getTime() === dateExtent[1].getTime()) {
    dateExtent[0] = new Date(dateExtent[0].getTime() - 86400000);
    dateExtent[1] = new Date(dateExtent[1].getTime() + 86400000);
  }
  const minValue = Math.min(...values);
  const maxValue = max(values) ?? minValue;
  const padding = Math.max((maxValue - minValue) * 0.2, 1);
  const x = scaleTime()
    .domain(dateExtent)
    .range([margin.left, width - margin.right]);
  const y = scaleLinear()
    .domain([minValue - padding, maxValue + padding])
    .nice()
    .range([height - margin.bottom, margin.top]);
  const draw = line<Measurement>()
    .x((row) => x(localDateAtNoon(row.measured_on)))
    .y((row) => y(weightInDisplayUnits(Number(row.weight_kg), units)))
    .curve(curveMonotoneX);

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Body weight measurements over time"
      >
        {y.ticks(4).map((tick) => (
          <g key={tick}>
            <line
              className="chart-grid"
              x1={margin.left}
              x2={width - margin.right}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text
              className="chart-label"
              x={margin.left - 9}
              y={y(tick) + 4}
              textAnchor="end"
            >
              {tick}
            </text>
          </g>
        ))}
        <path className="chart-line-depth" d={draw(filtered) ?? ""} />
        <path className="chart-line" d={draw(filtered) ?? ""} />
        {filtered.map((row) => (
          <g key={row.measured_on}>
            <circle
              className="chart-point-depth"
              cx={x(localDateAtNoon(row.measured_on))}
              cy={y(weightInDisplayUnits(Number(row.weight_kg), units))}
              r="4"
              transform="translate(0 6)"
            />
            <circle
              className="chart-point"
              cx={x(localDateAtNoon(row.measured_on))}
              cy={y(weightInDisplayUnits(Number(row.weight_kg), units))}
              r="4"
            >
              <title>{`${dateOnly(row.measured_on)}: ${displayWeight(Number(row.weight_kg), units)} ${units === "metric" ? "kg" : "lb"}`}</title>
            </circle>
          </g>
        ))}
        <text className="chart-label" x={margin.left} y={height - 10}>
          {dateExtent[0].toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </text>
        <text
          className="chart-label"
          x={width - margin.right}
          y={height - 10}
          textAnchor="end"
        >
          {dateExtent[1].toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </text>
      </svg>
      <p className="chart-caption">
        Weight · {units === "metric" ? "kg" : "lb"} · {filtered.length}{" "}
        measurements in this range
      </p>
      <table className="sr-table">
        <caption>Weight measurement data</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Weight ({units === "metric" ? "kg" : "lb"})</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr key={row.measured_on}>
              <td>{dateOnly(row.measured_on)}</td>
              <td>{displayWeight(Number(row.weight_kg), units)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StrengthChart({
  data,
  units,
}: {
  data: StrengthRecord[];
  units: "metric" | "imperial";
}) {
  if (!data.length)
    return (
      <div className="chart-empty">
        Log a strength record to see a trend here.
      </div>
    );
  const width = 680;
  const height = 240;
  const margin = { top: 18, right: 20, bottom: 38, left: 46 };
  const dates = data.map((row) => localDateAtNoon(row.performed_at));
  const values = data.map((row) =>
    weightInDisplayUnits(Number(row.weight_kg), units),
  );
  const dateExtent = extent(dates) as [Date, Date];
  if (dateExtent[0].getTime() === dateExtent[1].getTime()) {
    dateExtent[0] = new Date(dateExtent[0].getTime() - 86400000);
    dateExtent[1] = new Date(dateExtent[1].getTime() + 86400000);
  }
  const minValue = Math.min(...values);
  const maxValue = max(values) ?? minValue;
  const padding = Math.max((maxValue - minValue) * 0.2, 1);
  const x = scaleTime()
    .domain(dateExtent)
    .range([margin.left, width - margin.right]);
  const y = scaleLinear()
    .domain([Math.max(0, minValue - padding), maxValue + padding])
    .nice()
    .range([height - margin.bottom, margin.top]);
  const draw = line<StrengthRecord>()
    .x((row) => x(localDateAtNoon(row.performed_at)))
    .y((row) => y(weightInDisplayUnits(Number(row.weight_kg), units)))
    .curve(curveMonotoneX);
  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Logged strength loads over time"
      >
        {y.ticks(4).map((tick) => (
          <g key={tick}>
            <line
              className="chart-grid"
              x1={margin.left}
              x2={width - margin.right}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text
              className="chart-label"
              x={margin.left - 9}
              y={y(tick) + 4}
              textAnchor="end"
            >
              {tick}
            </text>
          </g>
        ))}
        <path className="chart-line-depth" d={draw(data) ?? ""} />
        <path className="chart-line" d={draw(data) ?? ""} />
        {data.map((row, index) => (
          <g key={`${row.performed_at}-${index}`}>
            <circle
              className="chart-point-depth"
              cx={x(localDateAtNoon(row.performed_at))}
              cy={y(Number(row.weight_kg))}
              r="4"
              transform="translate(0 6)"
            />
            <circle
              className="chart-point"
              cx={x(localDateAtNoon(row.performed_at))}
              cy={y(Number(row.weight_kg))}
              r="4"
            >
              <title>{`${dateOnly(row.performed_at)}: ${displayWeight(Number(row.weight_kg), units)} ${units === "metric" ? "kg" : "lb"} × ${row.repetitions}`}</title>
            </circle>
          </g>
        ))}
        <text className="chart-label" x={margin.left} y={height - 10}>
          {dateExtent[0].toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </text>
        <text
          className="chart-label"
          x={width - margin.right}
          y={height - 10}
          textAnchor="end"
        >
          {dateExtent[1].toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </text>
      </svg>
      <p className="chart-caption">
        Logged load · {units === "metric" ? "kg" : "lb"} · {data.length} records
      </p>
      <table className="sr-table">
        <caption>Strength load history</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Load ({units === "metric" ? "kg" : "lb"})</th>
            <th>Repetitions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={`${row.performed_at}-${index}`}>
              <td>{dateOnly(row.performed_at)}</td>
              <td>{displayWeight(Number(row.weight_kg), units)}</td>
              <td>{row.repetitions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Progress({
  api,
}: {
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
}) {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [records, setRecords] = useState<StrengthRecord[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [recordResult, setRecordResult] = useState("");
  const [selectedExercise, setSelectedExercise] = useState("");
  const [units, setUnits] = useState<"metric" | "imperial">("metric");
  const [currentDate] = useState(today);
  const [range, setRange] = useState<"30" | "90" | "all">("90");
  const [rangeAnchor] = useState(() => new Date());
  const load = useCallback(async () => {
    try {
      const [summary, history, profile] = await Promise.all([
        api<
          ApiResponse<{
            measurements: Measurement[];
            personalRecords: StrengthRecord[];
          }>
        >("/api/v1/progress/summary"),
        api<ApiResponse<StrengthRecord[]>>(
          "/api/v1/progress/strength-records?limit=366",
        ),
        api<ApiResponse<Profile>>("/api/v1/profile"),
      ]);
      setError("");
      setMeasurements(summary.data.measurements);
      setRecords(history.data);
      setUnits(profile.data.units);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Progress could not be loaded.",
      );
    }
  }, [api]);
  useEffect(() => {
    void load();
  }, [load]);
  const exerciseNames = useMemo(
    () => [...new Set(records.map((record) => record.exercise_name))].sort(),
    [records],
  );
  const rangeMeasurements = useMemo(() => {
    if (range === "all") return measurements;
    const cutoff = new Date(rangeAnchor);
    cutoff.setDate(cutoff.getDate() - Number(range));
    return measurements.filter(
      (row) => localDateAtNoon(row.measured_on) >= cutoff,
    );
  }, [measurements, range, rangeAnchor]);
  const selectedRecords = useMemo(
    () =>
      records
        .filter(
          (record) =>
            record.exercise_name === (selectedExercise || exerciseNames[0]),
        )
        .filter((record) => {
          if (range === "all") return true;
          const cutoff = new Date(rangeAnchor);
          cutoff.setDate(cutoff.getDate() - Number(range));
          return localDateAtNoon(record.performed_at) >= cutoff;
        })
        .sort((first, second) =>
          first.performed_at.localeCompare(second.performed_at),
        ),
    [exerciseNames, range, rangeAnchor, records, selectedExercise],
  );

  async function saveMeasurement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/api/v1/progress/measurements", {
        method: "POST",
        body: JSON.stringify({
          measuredOn: fields.get("date"),
          weightKg: weightInKilograms(Number(fields.get("weight")), units),
          bodyFatPercent: fields.get("bodyFat")
            ? Number(fields.get("bodyFat"))
            : undefined,
        }),
      });
      form.reset();
      await load();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Measurement could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveStrength(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setRecordResult("");
    try {
      const response = await api<
        ApiResponse<StrengthRecord> & { isPersonalRecord: boolean }
      >("/api/v1/progress/strength-records", {
        method: "POST",
        body: JSON.stringify({
          exerciseName: fields.get("exercise"),
          performedAt: fields.get("performedAt"),
          weightKg: weightInKilograms(Number(fields.get("weight")), units),
          repetitions: Number(fields.get("reps")),
        }),
      });
      setRecordResult(
        response.isPersonalRecord
          ? "New max-load personal record saved."
          : "Strength record saved.",
      );
      form.reset();
      await load();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Strength record could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="MEASURE WHAT MATTERS TO YOU"
        title="Progress"
        description="Your measurements and lift history, shown as you recorded them."
      />
      {error && <Notice onRetry={() => void load()}>{error}</Notice>}
      <div className="range-toolbar">
        <span className="eyebrow">DATE RANGE</span>
        <div role="group" aria-label="Choose progress date range">
          {(["30", "90", "all"] as const).map((value) => (
            <button
              className={range === value ? "range-active" : ""}
              aria-pressed={range === value}
              key={value}
              onClick={() => setRange(value)}
            >
              {value === "all" ? "All" : `${value} days`}
            </button>
          ))}
        </div>
      </div>
      <section className="surface chart-surface">
        <div className="section-heading">
          <div>
            <p className="eyebrow">BODY MEASUREMENTS</p>
            <h2>Weight trend</h2>
          </div>
          <span className="chart-unit">{units === "metric" ? "KG" : "LB"}</span>
        </div>
        <TrendChart data={rangeMeasurements} units={units} />
      </section>
      <section className="surface chart-surface">
        <div className="section-heading">
          <div>
            <p className="eyebrow">STRENGTH RECORDS</p>
            <h2>Lift trend</h2>
          </div>
          {exerciseNames.length > 0 && (
            <label className="chart-filter">
              EXERCISE
              <select
                aria-label="Choose exercise for strength chart"
                value={selectedExercise || exerciseNames[0]}
                onChange={(event) => setSelectedExercise(event.target.value)}
              >
                {exerciseNames.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <StrengthChart data={selectedRecords} units={units} />
      </section>
      <div className="progress-grid">
        <form className="surface form-surface" onSubmit={saveMeasurement}>
          <p className="eyebrow">BODY MEASUREMENT</p>
          <h2>Log weight</h2>
          <div className="stacked-fields">
            <label>
              Date
              <input
                name="date"
                type="date"
                defaultValue={currentDate}
                required
              />
            </label>
            <label>
              Weight ({units === "metric" ? "kg" : "lb"})
              <input
                name="weight"
                type="number"
                min={units === "metric" ? "20" : "44"}
                max={units === "metric" ? "500" : "1102"}
                step="0.1"
                required
              />
            </label>
            <label>
              Body fat (%) · optional
              <input name="bodyFat" type="number" min="1" max="75" step="0.1" />
            </label>
          </div>
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : "Save measurement"}
          </button>
        </form>
        <form className="surface form-surface" onSubmit={saveStrength}>
          <p className="eyebrow">STRENGTH HISTORY</p>
          <h2>Log a lift</h2>
          <div className="stacked-fields">
            <label>
              Exercise
              <input
                name="exercise"
                maxLength={120}
                placeholder="e.g. Bench press"
                required
              />
            </label>
            <label>
              Date
              <input
                name="performedAt"
                type="date"
                defaultValue={currentDate}
                required
              />
            </label>
            <div className="inline-fields">
              <label>
                Load ({units === "metric" ? "kg" : "lb"})
                <input
                  name="weight"
                  type="number"
                  min="0"
                  max={units === "metric" ? "2000" : "4409"}
                  step="0.5"
                  required
                />
              </label>
              <label>
                Reps
                <input name="reps" type="number" min="1" max="100" required />
              </label>
            </div>
          </div>
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : "Save strength record"}
          </button>
          {recordResult && (
            <p className="success-message" role="status">
              {recordResult}
            </p>
          )}
        </form>
      </div>
      <section className="surface history-surface">
        <div className="section-heading">
          <div>
            <p className="eyebrow">RECORDED LIFTS</p>
            <h2>Strength history</h2>
          </div>
          <span className="muted">{records.length} records</span>
        </div>
        {records.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Exercise</th>
                  <th>Date</th>
                  <th>Load</th>
                  <th>Reps</th>
                </tr>
              </thead>
              <tbody>
                {records.slice(0, 20).map((record, index) => (
                  <tr
                    key={`${record.exercise_name}-${record.performed_at}-${index}`}
                  >
                    <td>{record.exercise_name}</td>
                    <td>{dateOnly(record.performed_at)}</td>
                    <td>
                      {displayWeight(Number(record.weight_kg), units)}{" "}
                      {units === "metric" ? "kg" : "lb"}
                    </td>
                    <td>{record.repetitions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">
            Your strength records will appear here after you log a lift.
          </p>
        )}
      </section>
      <p className="small-note">
        Charts use up to 366 recent entries per series. Personal records are
        based on the highest logged load for an exercise name. FITFORGE does not
        estimate one-rep maxes.
      </p>
    </>
  );
}

function AiCoach({
  apiStream,
}: {
  apiStream: (path: string, init?: RequestInit) => Promise<Response>;
}) {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const conversationEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    conversationEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function askCoach(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = question.trim();
    if (!prompt || busy) return;

    setQuestion("");
    setError("");
    setMessages((current) => [
      ...current,
      { role: "user", content: prompt },
      { role: "assistant", content: "" },
    ]);
    setBusy(true);
    try {
      const response = await apiStream("/api/v1/coach/stream", {
        method: "POST",
        body: JSON.stringify({
          question: prompt,
          history: messages.slice(-8),
        }),
      });
      if (!response.body) {
        throw new Error("The coach connection did not provide a response.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";
      let receivedAnswer = false;
      let finished = false;
      const handleEvent = (line: string) => {
        if (!line.startsWith("data: ")) return;
        const event = JSON.parse(line.slice(6)) as {
          type: "token" | "done" | "error";
          token?: string;
          message?: string;
        };
        if (event.type === "token" && event.token) {
          receivedAnswer = true;
          setMessages((current) => {
            const next = [...current];
            const last = next[next.length - 1];
            if (last?.role === "assistant") {
              next[next.length - 1] = {
                ...last,
                content: last.content + event.token,
              };
            }
            return next;
          });
        } else if (event.type === "error") {
          throw new Error(
            event.message ?? "The coach could not finish replying.",
          );
        } else if (event.type === "done") {
          finished = true;
        }
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          pending += decoder.decode(value, { stream: !done });
          const lines = pending.split(/\r?\n/);
          pending = lines.pop() ?? "";
          lines.forEach(handleEvent);
          if (done) break;
        }
        if (pending) handleEvent(pending);
      } finally {
        reader.releaseLock();
      }
      if (!finished || !receivedAnswer) {
        throw new Error(
          "The coach response ended before a complete answer arrived.",
        );
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The coach could not reply. Please try again.",
      );
      setQuestion(prompt);
      setMessages((current) => {
        const last = current[current.length - 1];
        return last?.role === "assistant" && !last.content
          ? current.slice(0, -1)
          : current;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="coach-page">
      <PageHeading
        eyebrow="YOUR LOCAL FITNESS COMPANION"
        title="Meet your AI coach."
        description="Ask about movement, workout routines, or building healthy habits—one practical step at a time."
      />
      <div className="coach-safety-note" role="note">
        <span aria-hidden="true">✳</span>
        <p>
          <strong>A helpful guide, not a medical professional.</strong> Replies
          come from a local AI model and may be inaccurate. Your profile, meals,
          and workout logs are not shared automatically. For medical advice or
          injuries, talk with a qualified professional.
        </p>
      </div>
      <section className="surface coach-chat" aria-label="Chat with AI coach">
        <header className="coach-chat-header">
          <div className="coach-avatar" aria-hidden="true">
            ✳
          </div>
          <div>
            <h2>FITFORGE Coach</h2>
            <p>
              <span className="coach-online-dot" /> Powered privately on this
              server
            </p>
          </div>
          {messages.length > 0 && (
            <button
              className="text-button coach-clear"
              onClick={() => {
                setMessages([]);
                setError("");
              }}
              disabled={busy}
            >
              Clear chat
            </button>
          )}
        </header>
        <div className="coach-conversation" aria-live="polite">
          {messages.length === 0 ? (
            <div className="coach-welcome">
              <span className="coach-welcome-icon" aria-hidden="true">
                ✳
              </span>
              <h3>A good place to start.</h3>
              <p>
                Tell me what you’re working toward, and we’ll make the next step
                feel manageable.
              </p>
              <div className="coach-prompts">
                {[
                  "Help me plan my first week of workouts",
                  "What is a simple warm-up before exercise?",
                  "How can I build a consistent sleep routine?",
                ].map((suggestion) => (
                  <button
                    className="coach-prompt"
                    key={suggestion}
                    onClick={() => setQuestion(suggestion)}
                    disabled={busy}
                  >
                    {suggestion} <span aria-hidden="true">↗</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <article
                className={`coach-message ${message.role}`}
                key={`${message.role}-${index}`}
              >
                {message.role === "assistant" && (
                  <span className="coach-message-icon" aria-hidden="true">
                    ✳
                  </span>
                )}
                <p>{message.content}</p>
              </article>
            ))
          )}
          {busy && !messages[messages.length - 1]?.content && (
            <div className="coach-thinking" role="status">
              <span />
              <span />
              <span />
              <small>Putting a thoughtful answer together…</small>
            </div>
          )}
          {error && (
            <p className="coach-error" role="alert">
              {error}
            </p>
          )}
          <div ref={conversationEnd} />
        </div>
        <form className="coach-composer" onSubmit={askCoach}>
          <label className="sr-only" htmlFor="coach-question">
            Your question for the coach
          </label>
          <textarea
            id="coach-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Ask a fitness or healthy-habit question…"
            maxLength={1000}
            rows={2}
            disabled={busy}
          />
          <div className="coach-composer-footer">
            <span>Enter to send · Shift + Enter for a new line</span>
            <button
              className="button primary"
              type="submit"
              disabled={busy || !question.trim()}
            >
              {busy ? "Thinking…" : "Send"} <span aria-hidden="true">↗</span>
            </button>
          </div>
        </form>
      </section>
    </section>
  );
}

function Wellness({
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
                  {plan.dietDays.map((day) => (
                    <button
                      key={day.day}
                      className={selectedDay === day.day ? "active" : ""}
                      onClick={() => setSelectedDay(day.day)}
                    >
                      <small>DAY</small>
                      <strong>{day.day}</strong>
                    </button>
                  ))}
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
                            {selectedWorkoutDay.focus}
                          </p>
                          {selectedWorkoutDay.activities.length > 0 ? (
                            selectedWorkoutDay.activities.map((activity) => (
                              <article
                                className="wellness-activity"
                                key={`${activity.name}-${activity.minutes}`}
                              >
                                <div>
                                  <strong>{activity.name}</strong>
                                  <span>
                                    {activity.minutes} min · gentle pace
                                  </span>
                                </div>
                                <p>{activity.guidance}</p>
                              </article>
                            ))
                          ) : (
                            <p className="wellness-empty">
                              A rest day. Take it easy and choose comfortable
                              movement only if it feels right for you.
                            </p>
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

function Account({
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

export default App;
