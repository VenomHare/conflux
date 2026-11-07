"use client";
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { api, send } from "@/lib/client-api";
import { useWorkspaceFrame } from "@/components/workspace-frame";

type Workspace = {
  id: string;
  name: string;
  description: string | null;
  myRole: string;
};
type Page = {
  id: string;
  title: string;
  created_at?: string;
  updated_at: string;
};
const canEdit = (role?: string) =>
  ["OWNER", "ADMIN", "EDITOR"].includes(role ?? "");
function dateLabel(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  if (elapsed < 60_000) return "just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return `${Math.floor(elapsed / 86_400_000)}d ago`;
}

export function WorkspaceRouter() {
  const router = useRouter();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<{ workspaces: Workspace[] }>("/workspaces")
      .then(({ workspaces }) => {
        if (!active) return;
        if (!workspaces.length) router.replace("/onboarding");
        else {
          const last = localStorage.getItem("conflux:lastWorkspace");
          router.replace(
            `/w/${workspaces.some((w) => w.id === last) ? last : workspaces[0].id}`,
          );
        }
      })
      .catch(
        (e) =>
          active &&
          setError(
            e instanceof Error ? e.message : "Could not load workspaces",
          ),
      );
    return () => {
      active = false;
    };
  }, [router]);
  return (
    <main className="auth-wrap">
      <div className="status">
        {error || "Opening your workspace…"}
        {error && (
          <button className="secondary" onClick={() => location.reload()}>
            Retry
          </button>
        )}
      </div>
    </main>
  );
}

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

export function WorkspaceHome() {
  const params = useParams<{ workspaceId: string }>();
  const id = params.workspaceId;
  const router = useRouter();
  const { workspace, pages, setPages } = useWorkspaceFrame();
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"create" | "rename" | "delete" | null>(
    null,
  );
  const [target, setTarget] = useState<Page | null>(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    setError("");
    try {
      const list = await api<{ pages: Page[] }>(`/workspaces/${id}/pages`);
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

export function PageDetail() {
  const params = useParams<{ workspaceId: string; pageId: string }>();
  const { workspaceId, pageId } = params;
  const { workspace, setPages } = useWorkspaceFrame();
  const [page, setPage] = useState<Page | null>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const yTextRef = useRef<Y.Text | null>(null);
  const yDocRef = useRef<Y.Doc | null>(null);


  useEffect(() => {
    let active = true;
    api<{ page: Page }>(`/pages/${pageId}`)
      .then((p) => {
        if (active) {
          setPage(p.page);
          setTitle(p.page.title);
        }
      })
      .catch(
        (e) =>
          active &&
          setError(e instanceof Error ? e.message : "Page could not be loaded"),
      );
    return () => {
      active = false;
    };
  }, [workspaceId, pageId]);
  useEffect(() => {
    const doc = new Y.Doc();
    yDocRef.current = doc;
    const wsProvider = new WebsocketProvider(
      "ws://localhost:8008",
      pageId,
      doc,
    );
    const sharedText = doc.getText("content");
    yTextRef.current = sharedText;

    const syncBody = () => setBody(sharedText.toString());
    syncBody();
    sharedText.observe(syncBody);

    return () => {
      sharedText.unobserve(syncBody);
      yTextRef.current = null;
      yDocRef.current = null;
      wsProvider.destroy();
      doc.destroy();
    };
  }, [pageId]);

  async function save() {
    setStatus("Saving…");
    try {
      const result = await api<{ page: Page }>(
        `/pages/${pageId}`,
        send("PATCH", { title }),
      );
      setPage(result.page);
      setPages((current) =>
        current.map((item) => (item.id === pageId ? result.page : item)),
      );
      setStatus("Saved");
      setTimeout(() => setStatus(""), 2000);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not save title");
    }
  }
  if (error)
    return (
      <main className="auth-wrap">
        <div className="status">
          {error}{" "}
          <Link className="link" href={`/w/${workspaceId}`}>
            Back to workspace
          </Link>
        </div>
      </main>
    );
  if (!page) return null;
  const editable = canEdit(workspace.myRole);
  return (
    <section className="main">
      <header className="topbar">
        <div className="topbar-leading">
          <div className="topbar-sidebar-toggle-slot" />
          <div>
            <Link href={`/w/${workspaceId}`}>{workspace.name}</Link>{" "}
            <span className="muted">/</span> {title || "Untitled"}
          </div>
        </div>
        <div className="top-actions">
          <span className="status">{status}</span>
          <Link className="secondary" href={`/w/${workspaceId}`}>
            All pages
          </Link>
        </div>
      </header>
      <main className="content">
        <div className="eyebrow">{editable ? "Page" : "View only"}</div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <input
            className="editor-title"
            aria-label="Page title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            readOnly={!editable}
            onBlur={(e) => {
              if (editable && e.currentTarget.value !== page.title)
                void save();
            }}
          />
          <span className="muted">{status}</span>
          <textarea
            value={body}
            readOnly={!editable}
            onChange={(event) => {

              const sharedText = yTextRef.current;
              const doc = yDocRef.current;
              if (!sharedText || !doc) return;

              doc.transact(() => {
                sharedText.delete(0, sharedText.length);
                sharedText.insert(0, event.target.value);
              });
            }}
            style={{
              // borderTop: "1px solid var(--border)",
              border: "none",
              background: "transparent",
              outline: "none",
              marginTop: 30,
              paddingTop: 24,
              textDecoration: "none",
              width: "100%",
              resize: "none",
              height: "50svh",
              minHeight: "fit-content"
            }}
          >
          </textarea>
        </form>
      </main>
    </section>
  );
}
