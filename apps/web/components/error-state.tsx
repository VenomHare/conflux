"use client";

import Link from "next/link";
import { useEffect } from "react";

type ErrorStateProps = {
  code: string;
  title: string;
  description: string;
  onRetry?: () => void;
};

export function ErrorState({
  code,
  title,
  description,
  onRetry,
}: ErrorStateProps) {
  useEffect(() => {
    const theme = localStorage.getItem("conflux:theme") ?? "system";
    const dark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, []);

  return (
    <main className="error-screen" aria-labelledby="error-title">
      <section className="error-card">
        <Link className="error-brand" href="/" aria-label="Conflux home">
          <span className="brand-dot">c</span>onflux
        </Link>
        <div className="error-rule" />
        {/* <p className="error-code">{code}</p> */}
        <h1 id="error-title">{title}</h1>
        <p className="error-description">{description}</p>
        <div className="error-actions">
          <Link className="error-home" href="/">
            Return to home
            <span aria-hidden="true">↗</span>
          </Link>
          {onRetry && (
            <button className="error-retry" type="button" onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      </section>
      <p className="error-footnote">A quieter place to get your thoughts in order.</p>
    </main>
  );
}
