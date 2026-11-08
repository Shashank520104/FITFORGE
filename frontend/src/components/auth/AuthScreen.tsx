import { useState, type FormEvent } from "react";
import { readResponse } from "../../services/api.js";
import type { ApiResponse, Session, User } from "../../types/index.js";
import { BrandMark } from "../common/BrandMark.js";

export function AuthScreen({
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
