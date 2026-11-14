"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, send } from "@/lib/client-api";
import type { Workspace } from "@/components/workspace-types";

export function Onboarding() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [description, setDescription] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const { workspace } = await api<{ workspace: Workspace }>(
        "/workspaces",
        send("POST", {
          name: data.get("name"),
          description: data.get("description") || null,
        }),
      );
      await api(
        `/workspaces/${workspace.id}/pages`,
        send("POST", { title: "Getting started" }),
      );
      localStorage.setItem("conflux:lastWorkspace", workspace.id);
      router.replace(`/w/${workspace.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create workspace");
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
        <h1>Name your workspace</h1>
        <p className="muted">A shared home for your team's notes and ideas.</p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="name">Workspace name</label>
            <input
              id="name"
              name="name"
              required
              maxLength={100}
              placeholder="e.g. Acme Design"
              autoFocus
            />
          </div>
          {description ? (
            <div className="field">
              <label htmlFor="description">
                Description <span className="muted">(optional)</span>
              </label>
              <textarea
                id="description"
                name="description"
                maxLength={1000}
                rows={3}
                placeholder="What is this workspace for?"
              />
            </div>
          ) : (
            <button
              className="quiet"
              type="button"
              onClick={() => setDescription(true)}
            >
              ＋ Add description
            </button>
          )}
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Creating…" : "Create workspace"}
          </button>
        </form>
      </section>
    </main>
  );
}
