"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client-api";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const registerHref = next ? `/register?next=${encodeURIComponent(next)}` : "/register";
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const login = mode === "login";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const values = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    try {
      await api(login ? "/auth/login" : "/auth/register", {
        method: "POST",
        body: JSON.stringify(values),
      });
      router.replace(params.get("next") || (login ? "/" : "/onboarding"));
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to connect. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <div className="brand">
          Conflux<span className="brand-dot">.</span>
        </div>
        <h1>{login ? "Welcome back" : "Create your account"}</h1>
        <p className="muted">
          {login
            ? "Sign in to pick up where you left off."
            : "A quieter place for your team's work."}
        </p>
        <form onSubmit={submit}>
          {!login && (
            <div className="field">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                name="name"
                autoComplete="name"
                required
                maxLength={100}
                placeholder="Your name"
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@company.com"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={login ? "current-password" : "new-password"}
              required
              minLength={login ? 1 : 12}
              maxLength={72}
              placeholder={login ? "Your password" : "At least 12 characters"}
            />
            {!login && (
              <small className="muted">Use at least 12 characters.</small>
            )}
            <button
              className="quiet"
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide password" : "Show password"}
            </button>
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Please wait…" : login ? "Log in" : "Create account"}
          </button>
        </form>
        <p className="auth-foot">
          {login ? (
            <>
              New to Conflux? <Link href={registerHref}>Create an account</Link>
            </>
          ) : (
            <>
              Already have an account? <Link href={loginHref}>Log in</Link>
            </>
          )}
        </p>
      </section>
    </main>
  );
}
