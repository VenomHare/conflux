"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, send } from "@/lib/client-api";
import { useWorkspaceFrame } from "@/components/workspace-frame";
import { PageSidePanel } from "@/components/page-side-panel";
import { EditorToolbar } from "@/components/editor-toolbar";
import { canEdit } from "@/components/workspace-types";
import type { Page } from "@/components/workspace-types";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Collaboration } from "@tiptap/extension-collaboration";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";

export function PageDetail() {
  const params = useParams<{ workspaceId: string; pageId: string }>();
  const { workspaceId, pageId } = params;
  const { workspace, setPages, user } = useWorkspaceFrame();
  const [page, setPage] = useState<Page | null>(null);
  const [hasCollaborativeUpdates, setHasCollaborativeUpdates] = useState(false);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("Connecting…");
  const [titleStatus, setTitleStatus] = useState("");
  const [editorReady, setEditorReady] = useState(false);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<"comments" | "history" | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTitle = useRef("");
  const ydoc = useMemo(() => new Y.Doc(), [pageId]);
  const connectionDoc = useMemo(
    () => (canEdit(workspace.myRole) ? ydoc : new Y.Doc()),
    [workspace.myRole, ydoc],
  );

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
  const extensions = useMemo(
    () => [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: ydoc }),
    ],
    [ydoc],
  );
  const editor = useEditor(
    {
      extensions,
      content: "",
      editable: canEdit(workspace.myRole) && editorReady,
      immediatelyRender: false,
    },
    [ydoc],
  );
  useEffect(() => {
    if (!editor || !page) return;
    editor.setEditable(canEdit(workspace.myRole) && editorReady);
  }, [editor, page, workspace.myRole, editorReady]);

  useEffect(() => {
    if (!editor || !page) return;
    let disposed = false;
    let provider: WebsocketProvider | null = null;
    let bridgeRemoteUpdates:
      | ((update: Uint8Array, origin: unknown) => void)
      | null = null;
    let clearedLegacyContent = false;
    setStatus("Connecting…");

    const serverUrl = (
      process.env.NEXT_PUBLIC_COLLAB_URL ??
      `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:8008`
    ).replace(/\/+$/, "");
    const canEditPage = canEdit(workspace.myRole);

    // Seed legacy content into the editor document. Read-only sessions use a
    // separate, empty document for WebSocket transport so this fallback never
    // gets sent to the server.
    if (
      !hasCollaborativeUpdates &&
      ydoc.getXmlFragment("default").length === 0 &&
      page.content
    ) {
      let content: string | Record<string, unknown> = page.content;
      try {
        content = JSON.parse(page.content) as Record<string, unknown>;
      } catch {
        // Keep legacy plain-text or HTML content as-is.
      }
      editor.commands.setContent(
        content as Parameters<typeof editor.commands.setContent>[0],
        { emitUpdate: false },
      );
    }
    setEditorReady(true);
    const tokenRefreshTimer = setInterval(
      () => {
        void api<{ token: string }>("/auth/ws-token")
          .then(({ token }) => {
            if (!disposed && provider)
              provider.params = { ...provider.params, token };
          })
          .catch(() => {});
      },
      50 * 60 * 1000,
    );

    void api<{ token: string }>("/auth/ws-token")
      .then(({ token }) => {
        if (disposed) return;
        provider = new WebsocketProvider(serverUrl, pageId, connectionDoc, {
          connect: false,
          // Restores replace the document's CRDT history. A background tab
          // holding the pre-restore Y.Doc must not merge it back locally.
          // The collaboration server already syncs all tabs over WebSocket.
          disableBc: true,
          params: { token },
          shouldReconnect: (event) =>
            event.code !== 1008 && event.code !== 1003 && event.code !== 4401,
        });
        bridgeRemoteUpdates = (update: Uint8Array, origin: unknown) => {
          if (canEditPage || origin !== provider || disposed) return;
          const fragment = ydoc.getXmlFragment("default");
          if (!clearedLegacyContent) {
            if (fragment.length > 0) fragment.delete(0, fragment.length);
            clearedLegacyContent = true;
          }
          Y.applyUpdate(ydoc, update, provider);
        };
        if (!canEditPage)
          connectionDoc.on("update", bridgeRemoteUpdates);
        provider.on("status", ({ status: connectionStatus }) => {
          console.log(
            `[restore] websocket status page=${pageId} status=${connectionStatus}`,
          );
          if (disposed) return;
          setStatus(
            connectionStatus === "connected"
              ? canEditPage
                ? "Connected"
                : "View only"
              : connectionStatus === "connecting"
                ? "Connecting…"
                : "Offline",
          );
        });
        provider.on("sync", (synced) => {
          console.log(
            `[restore] browser sync page=${pageId} synced=${synced} stateVectorBytes=${Y.encodeStateVector(ydoc).byteLength} paragraphs=${ydoc.getXmlFragment("default").length} editorHtml=${editor.getHTML().slice(0, 120)}`,
          );
          if (disposed || !synced) return;
          setStatus(canEditPage ? "Connected" : "View only");
        });
        provider.on("closed", ({ code, reason }) => {
          console.log(
            `[restore] websocket closed page=${pageId} code=${code} reason=${reason}`,
          );
          if (code === 4401) {
            window.location.reload();
            return;
          }
          if (!disposed)
            setStatus(
              `Connection rejected (${code}): ${reason || "request was rejected"}`,
            );
        });
        provider.on("connection-error", (event) => {
          console.error(
            `[restore] websocket connection error page=${pageId} ${String(event)}`,
          );
        });
        provider.connect();
      })
      .catch(() => {
        if (!disposed) setStatus("Offline");
      });

    return () => {
      disposed = true;
      clearInterval(tokenRefreshTimer);
      if (!canEditPage && bridgeRemoteUpdates)
        connectionDoc.off("update", bridgeRemoteUpdates);
      provider?.destroy();
    };
  }, [
    connectionDoc,
    editor,
    page,
    pageId,
    ydoc,
    workspace.myRole,
    hasCollaborativeUpdates,
  ]);

  useEffect(
    () => () => {
      if (statusTimer.current) clearTimeout(statusTimer.current);
    },
    [],
  );

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
          <button
            className={`secondary${panel === "comments" ? " is-active" : ""}`}
            type="button"
            aria-expanded={panel === "comments"}
            aria-controls="page-side-panel"
            onClick={() => setPanel(panel === "comments" ? null : "comments")}
          >
            Comments
          </button>
          <button
            className={`secondary${panel === "history" ? " is-active" : ""}`}
            type="button"
            aria-expanded={panel === "history"}
            aria-controls="page-side-panel"
            onClick={() => setPanel(panel === "history" ? null : "history")}
          >
            History
          </button>
          <Link className="secondary" href={`/w/${workspaceId}`}>
            All pages
          </Link>
        </div>
      </header>
      <main className="page-editor-shell">
        <div className="page-editor-toolbar-wrap">
          <div className="page-editor-toolbar">
            <EditorToolbar editor={editorReady ? editor : null} />
            <span className="page-editor-save-status" aria-live="polite">
              {titleStatus ||
                (status === "Offline"
                  ? status
                  : editable
                    ? status
                    : "View only")}
            </span>
          </div>
        </div>
        <div className="page-editor-content">
          <div className="page-editor-meta">
            {editable ? "A page in " : "Viewing in "}
            {workspace.name}
          </div>
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
            <EditorContent editor={editor} className="page-editor-prose" />
          </div>
        </div>
        {panel && (
          <PageSidePanel
            kind={panel}
            onClose={() => setPanel(null)}
            pageId={pageId}
            editor={editor}
            doc={ydoc}
            role={workspace.myRole}
            userId={user.id}
          />
        )}
      </main>
    </section>
  );
}
