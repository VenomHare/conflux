"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { api, send } from "@/lib/client-api";
import { useWorkspaceFrame } from "@/components/workspace-frame";
import { dateLabel } from "@/components/date-label";
import { canEdit } from "@/components/workspace-types";
import type { Page, PageSummary } from "@/components/workspace-types";

export function WorkspaceHome() {
  const params = useParams<{ workspaceId: string }>();
  const id = params.workspaceId;
  const router = useRouter();
  const { workspace, pages, setPages } = useWorkspaceFrame();
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"create" | "rename" | "delete" | null>(
    null,
  );
  const [target, setTarget] = useState<PageSummary | null>(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    setError("");
    try {
      const list = await api<{ pages: PageSummary[] }>(
        `/workspaces/${id}/pages`,
      );
      const sortedPages = list.pages.sort(
        (a, b) => +new Date(b.updated_at) - +new Date(a.updated_at),
      );
      setPages(sortedPages);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load this workspace",
      );
    }
  }
  async function mutate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      if (modal === "create") {
        const result = await api<{ page: Page }>(
          `/workspaces/${id}/pages`,
          send("POST", { title: data.get("title") }),
        );
        setPages((current) => [result.page, ...current]);
        router.push(`/w/${id}/p/${result.page.id}`);
      }
      if (modal === "rename" && target) {
        await api(
          `/pages/${target.id}`,
          send("PATCH", { title: data.get("title") }),
        );
        await load();
      }
      if (modal === "delete" && target) {
        await api(`/pages/${target.id}`, send("DELETE"));
        setPages((old) => old.filter((p) => p.id !== target.id));
      }
      setModal(null);
      setTarget(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "That change could not be saved",
      );
    } finally {
      setBusy(false);
    }
  }
  const editable = canEdit(workspace.myRole);
  return (
    <>
      <section className="main">
        <header className="topbar">
          <div className="topbar-leading">
            <div className="topbar-sidebar-toggle-slot" />
            <div>
              <Link href={`/w/${id}`}>{workspace.name}</Link>{" "}
              <span className="muted">/</span> All pages
            </div>
          </div>
          <div className="top-actions">
            <span className="muted">{workspace.myRole?.toLowerCase()}</span>
          </div>
        </header>
        <main className="content">
          <div className="eyebrow">Your workspace</div>
          <h1 className="page-heading">{workspace.name}</h1>
          {workspace.description && (
            <p className="muted">{workspace.description}</p>
          )}
          <div className="section-heading">
            Pages <span className="muted">{pages.length}</span>
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}{" "}
              <button className="quiet" onClick={() => void load()}>
                Retry
              </button>
            </div>
          )}
          {!pages.length ? (
            <div className="empty">
              <div style={{ fontSize: 26, marginBottom: 12 }}>▤</div>
              <strong>No pages yet</strong>
              <p>Create your first page to start writing together.</p>
              {editable && (
                <button
                  className="primary"
                  style={{ maxWidth: 180 }}
                  onClick={() => setModal("create")}
                >
                  ＋ New page
                </button>
              )}
            </div>
          ) : (
            <div className="cards">
              {editable && (
                <button
                  className="card new-card"
                  onClick={() => setModal("create")}
                >
                  <span style={{ fontSize: 22 }}>＋</span>New page
                </button>
              )}
              {pages.map((page) => (
                <div className="card" key={page.id}>
                  <Link href={`/w/${id}/p/${page.id}`}>
                    <div className="card-title">{page.title || "Untitled"}</div>
                    <div className="card-meta">
                      Edited {dateLabel(page.updated_at)}
                    </div>
                  </Link>
                  {editable && (
                    <div
                      className="toolbar"
                      style={{ justifyContent: "flex-end", marginTop: 10 }}
                    >
                      <button
                        className="quiet"
                        aria-label={`Rename ${page.title}`}
                        onClick={() => {
                          setTarget(page);
                          setModal("rename");
                        }}
                      >
                        Rename
                      </button>
                      <button
                        className="quiet"
                        aria-label={`Delete ${page.title}`}
                        onClick={() => {
                          setTarget(page);
                          setModal("delete");
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </section>
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setModal(null);
              setTarget(null);
            }
          }}
        >
          <section className="modal" role="dialog" aria-modal="true">
            <h2>
              {modal === "create"
                ? "New page"
                : modal === "rename"
                  ? "Rename page"
                  : "Delete page?"}
            </h2>
            <p className="muted">
              {modal === "delete"
                ? `“${target?.title}” will be removed from this workspace.`
                : modal === "create"
                  ? "Give this page a name to get started."
                  : "Choose a new title for this page."}
            </p>
            <form onSubmit={mutate}>
              {modal !== "delete" && (
                <div className="field">
                  <label htmlFor="title">Page title</label>
                  <input
                    id="title"
                    name="title"
                    required
                    maxLength={200}
                    defaultValue={modal === "rename" ? target?.title : ""}
                    autoFocus
                  />
                </div>
              )}
              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setModal(null)}
                >
                  Cancel
                </button>
                <button
                  className={modal === "delete" ? "danger-button" : "primary"}
                  style={{ width: "auto", margin: 0 }}
                  disabled={busy}
                >
                  {busy
                    ? "Saving…"
                    : modal === "delete"
                      ? "Delete page"
                      : modal === "rename"
                        ? "Save title"
                        : "Create page"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
