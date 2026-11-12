"use client";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { api, send } from "@/lib/client-api";
import { useWorkspaceFrame } from "@/components/workspace-frame";
import { Editor, EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Collaboration } from "@tiptap/extension-collaboration";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";

type Workspace = {
  id: string;
  name: string;
  description: string | null;
  myRole: string;
};
type Page = {
  id: string;
  title: string;
  content: string;
  created_at?: string;
  updated_at: string;
};
type PageSummary = Omit<Page, "content">;
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
  const [target, setTarget] = useState<PageSummary | null>(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    setError("");
    try {
      const list = await api<{ pages: PageSummary[] }>(`/workspaces/${id}/pages`);
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
  const [hasCollaborativeUpdates, setHasCollaborativeUpdates] = useState(false);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("Connecting…");
  const [titleStatus, setTitleStatus] = useState("");
  const [editorReady, setEditorReady] = useState(false);
  const [error, setError] = useState("");
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTitle = useRef("");
  const ydoc = useMemo(() => new Y.Doc(), [pageId]);

  useEffect(() => {
    let active = true;
    setPage(null);
    setEditorReady(false);
    setError("");
    api<{ page: Page; hasCollaborativeUpdates: boolean }>(`/pages/${pageId}`)
      .then((p) => {
        if (active) {
          setPage(p.page);
          setHasCollaborativeUpdates(p.hasCollaborativeUpdates);
          setTitle(p.page.title);
          savedTitle.current = p.page.title;
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
  const extensions = useMemo(() => [
    StarterKit.configure({ undoRedo: false }),
    Collaboration.configure({ document: ydoc }),
  ], [ydoc]);
  const editor = useEditor({
    extensions,
    content: "",
    editable: canEdit(workspace.myRole) && editorReady,
    immediatelyRender: false,
  }, [ydoc]);
  useEffect(() => {
    if (!editor || !page) return;
    editor.setEditable(canEdit(workspace.myRole) && editorReady);
  }, [editor, page, workspace.myRole, editorReady]);

  useEffect(() => {
    if (!editor || !page) return;
    let disposed = false;
    let provider: WebsocketProvider | null = null;
    setStatus("Connecting…");

    const serverUrl = (
      process.env.NEXT_PUBLIC_COLLAB_URL ??
      `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:8008`
    ).replace(/\/+$/, "");
    const canEditPage = canEdit(workspace.myRole);

    // Seed documents that predate Yjs before connecting. This lets editors
    // continue working locally when the collaboration server is unavailable;
    // Yjs will merge those edits when the provider reconnects.
    if (!hasCollaborativeUpdates && ydoc.getXmlFragment("default").length === 0 && page.content) {
      let content: string | Record<string, unknown> = page.content;
      try {
        content = JSON.parse(page.content) as Record<string, unknown>;
      } catch {
        // Keep legacy plain-text or HTML content as-is.
      }
      editor.commands.setContent(content as Parameters<typeof editor.commands.setContent>[0], { emitUpdate: false });
    }
    setEditorReady(true);
    const tokenRefreshTimer = setInterval(() => {
      void api<{ token: string }>("/auth/ws-token")
        .then(({ token }) => {
          if (!disposed && provider) provider.params = { ...provider.params, token };
        })
        .catch(() => {});
    }, 50 * 60 * 1000);

    void api<{ token: string }>("/auth/ws-token")
      .then(({ token }) => {
        if (disposed) return;
        provider = new WebsocketProvider(serverUrl, pageId, ydoc, {
          connect: false,
          params: { token },
          shouldReconnect: (event) => event.code !== 1008 && event.code !== 1003,
        });
        provider.on("status", ({ status: connectionStatus }) => {
          if (disposed) return;
          setStatus(!canEditPage && !hasCollaborativeUpdates ? "View only" :
            connectionStatus === "connected" ? "Connected" :
              connectionStatus === "connecting" ? "Connecting…" : "Offline");
        });
        provider.on("sync", (synced) => {
          if (disposed || !synced) return;
          if (!canEditPage && !hasCollaborativeUpdates) provider?.disconnect();
          setStatus(canEditPage ? "Connected" : "View only");
        });
        provider.on("closed", ({ code, reason }) => {
          if (!disposed) setStatus(`Connection rejected (${code}): ${reason || "request was rejected"}`);
        });
        provider.connect();
      })
      .catch(() => {
        if (!disposed) setStatus("Offline");
      });

    return () => {
      disposed = true;
      clearInterval(tokenRefreshTimer);
      provider?.destroy();
    };
  }, [editor, page, pageId, ydoc, workspace.myRole, hasCollaborativeUpdates]);

  useEffect(() => () => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
  }, []);

  async function save() {
    setTitleStatus("Saving…");
    try {
      const result = await api<{ page: Page }>(
        `/pages/${pageId}`,
        send("PATCH", { title }),
      );
      savedTitle.current = result.page.title;
      setPages((current) =>
        current.map((item) => (item.id === pageId ? result.page : item)),
      );
      setTitleStatus("Saved");
      if (statusTimer.current) clearTimeout(statusTimer.current);
      statusTimer.current = setTimeout(() => setTitleStatus(""), 2000);
    } catch (e) {
      setTitleStatus(e instanceof Error ? e.message : "Could not save title");
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
          <Link className="secondary" href={`/w/${workspaceId}`}>
            All pages
          </Link>
        </div>
      </header>
      <main className="page-editor-shell">
        <div className="page-editor-toolbar-wrap">
          <div className="page-editor-toolbar">
            <EditorToolbar editor={editorReady ? editor : null} />
            <span className="page-editor-save-status" aria-live="polite">{titleStatus || (status === "Offline" ? status : editable ? status : "View only")}</span>
          </div>
        </div>
        <div className="page-editor-content">
          <div className="page-editor-meta">{editable ? "A page in " : "Viewing in "}{workspace.name}</div>
          <input
            className="editor-title"
            aria-label="Page title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            readOnly={!editable}
            onBlur={(e) => {
              if (editable && e.currentTarget.value !== savedTitle.current)
                void save();
            }}
          />
          <div className="page-editor-writing-area">
            <EditorContent
              editor={editor}
              className="page-editor-prose"
            />
          </div>
        </div>
      </main>
    </section>
  );
}

function EditorToolbar({ editor }: { editor: Editor | null }) {
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive("bold") ?? false,
      italic: current?.isActive("italic") ?? false,
      strike: current?.isActive("strike") ?? false,
      code: current?.isActive("code") ?? false,
      heading: [1, 2, 3].find((level) => current?.isActive("heading", { level })) ?? 0,
      bulletList: current?.isActive("bulletList") ?? false,
      orderedList: current?.isActive("orderedList") ?? false,
      blockquote: current?.isActive("blockquote") ?? false,
      link: current?.isActive("link") ?? false,
    }),
  });
  if (!editor || !active) return null;
  const button = (label: string, title: string, selected: boolean, action: () => void) => (
    <button type="button" className={`editor-tool${selected ? " is-active" : ""}`} aria-label={title} title={title} onMouseDown={(event) => event.preventDefault()} onClick={action}>{label}</button>
  );
  return <div className="editor-toolbar-controls" role="toolbar" aria-label="Text formatting">
    {button("B", "Bold", active.bold, () => editor.chain().focus().toggleBold().run())}
    {button("I", "Italic", active.italic, () => editor.chain().focus().toggleItalic().run())}
    {button("S", "Strikethrough", active.strike, () => editor.chain().focus().toggleStrike().run())}
    {button("</>", "Inline code", active.code, () => editor.chain().focus().toggleCode().run())}
    <span className="editor-toolbar-divider" />
    {button("H1", "Heading 1", active.heading === 1, () => editor.chain().focus().toggleHeading({ level: 1 }).run())}
    {button("H2", "Heading 2", active.heading === 2, () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
    {button("•", "Bulleted list", active.bulletList, () => editor.chain().focus().toggleBulletList().run())}
    {button("1.", "Numbered list", active.orderedList, () => editor.chain().focus().toggleOrderedList().run())}
    {button("❝", "Quote", active.blockquote, () => editor.chain().focus().toggleBlockquote().run())}
    {button("↗", "Add or edit link", active.link, () => {
      const url = window.prompt("Paste a link");
      if (url) editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
      else if (active.link) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    })}
  </div>;
}

