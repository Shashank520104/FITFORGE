import { useEffect, useState } from "react";
import "./App.css";
import { AuthScreen } from "./components/auth/AuthScreen.js";
import { BrandMark } from "./components/common/BrandMark.js";
import { GymArrivalScene } from "./components/common/GymArrivalScene.js";
import { AccountPage } from "./pages/Account/AccountPage.js";
import { ActivityPage } from "./pages/Activity/ActivityPage.js";
import { CoachPage } from "./pages/Coach/CoachPage.js";
import { ExercisesPage } from "./pages/Exercises/ExercisesPage.js";
import { NutritionPage } from "./pages/Nutrition/NutritionPage.js";
import { OverviewPage } from "./pages/Overview/OverviewPage.js";
import { PlansPage } from "./pages/Plans/PlansPage.js";
import { ProgressPage } from "./pages/Progress/ProgressPage.js";
import { WellnessPage } from "./pages/Wellness/WellnessPage.js";
import { refreshSession, useApi, useApiStream } from "./services/api.js";
import type { Page, Session } from "./types/index.js";

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
                <OverviewPage
                  api={api}
                  onNavigate={setPage}
                  user={session.user}
                />
              )}
              {page === "plans" && <PlansPage api={api} />}
              {page === "exercises" && <ExercisesPage api={api} />}
              {page === "nutrition" && <NutritionPage api={api} />}
              {page === "activity" && <ActivityPage api={api} />}
              {page === "wellness" && <WellnessPage api={api} />}
              {page === "progress" && <ProgressPage api={api} />}
              {page === "assistant" && <CoachPage apiStream={apiStream} />}
              {page === "account" && (
                <AccountPage
                  api={api}
                  user={session.user}
                  onLogout={logout}
                />
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

export default App;
