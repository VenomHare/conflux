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
import { Extension } from "@tiptap/react";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { Collaboration } from "@tiptap/extension-collaboration";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import { debugLog } from "@/lib/debug";

type AwarenessRef = {
  current: { getStates(): Map<number, Record<string, unknown>> } | null;
};

const remotePresenceKey = new PluginKey("remotePresence");

function remotePresenceExtension(
  awarenessRef: AwarenessRef,
  localUserId: string,
) {
  return Extension.create({
    name: "remotePresence",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: remotePresenceKey,
          props: {
            decorations(state) {
              const decorations: Decoration[] = [];
              for (const remote of awarenessRef.current?.getStates().values() ??
                []) {
                const person = remote.user as
                  | { userId?: string; name?: string; color?: string }
                  | undefined;
                const cursor = remote.cursor as
                  { anchor?: number; head?: number } | undefined;
                if (
                  !person?.userId ||
                  person.userId === localUserId ||
                  !person.name ||
                  !cursor ||
                  !Number.isInteger(cursor?.anchor) ||
                  !Number.isInteger(cursor?.head)
                )
                  continue;
                const anchor = cursor.anchor!;
                const head = cursor.head!;
                if (
                  anchor < 0 ||
                  head < 0 ||
                  anchor > state.doc.content.size ||
                  head > state.doc.content.size
                )
                  continue;
                const color = person.color ?? "#397a68";
                if (anchor !== head) {
                  decorations.push(
                    Decoration.inline(
                      Math.min(anchor, head),
                      Math.max(anchor, head),
                      {
                        class: "remote-cursor-selection",
                        style: `--remote-cursor-color: ${color}`,
                      },
                    ),
                  );
                }
                const caret = document.createElement("span");
                caret.className = "remote-cursor-caret";
                caret.style.setProperty("--remote-cursor-color", color);
                caret.dataset.label = person.name;
                decorations.push(
                  Decoration.widget(head, caret, { key: person.userId }),
                );
              }
              return DecorationSet.create(state.doc, decorations);
            },
          },
        }),
      ];
    },
  });
}

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
  const [collaborators, setCollaborators] = useState<
    { userId: string; name: string; avatarUrl: string | null }[]
  >([]);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<"comments" | "history" | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTitle = useRef("");
  const awarenessRef = useRef<AwarenessRef["current"]>(null);
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
      remotePresenceExtension(awarenessRef, user.id),
    ],
    [ydoc, user.id],
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
      ((update: Uint8Array, origin: unknown) => void) | null = null;
    let selectionListener: (() => void) | null = null;
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
          // Reconcile with the authoritative server state every second to
          // recover from a missed update while the socket remains open.
          resyncInterval: 1000,
          params: { token },
          shouldReconnect: (event) =>
            event.code !== 1008 && event.code !== 1003 && event.code !== 4401,
        });
        awarenessRef.current = provider.awareness;
        provider.awareness.setLocalStateField("user", {
          userId: user.id,
          name: user.name,
          avatarUrl: user.avatar_url ?? null,
        });
        const updateCollaborators = () => {
          const unique = new Map<
            string,
            { userId: string; name: string; avatarUrl: string | null }
          >();
          for (const state of provider?.awareness.getStates().values() ?? []) {
            const person = state.user as
              | { userId?: unknown; name?: unknown; avatarUrl?: unknown }
              | undefined;
            if (
              typeof person?.userId === "string" &&
              typeof person.name === "string"
            ) {
              unique.set(person.userId, {
                userId: person.userId,
                name: person.name,
                avatarUrl:
                  typeof person.avatarUrl === "string"
                    ? person.avatarUrl
                    : null,
              });
            }
          }
          setCollaborators([...unique.values()]);
          if (editor)
            editor.view.dispatch(
              editor.state.tr.setMeta(remotePresenceKey, true),
            );
        };
        provider.awareness.on("change", updateCollaborators);
        updateCollaborators();
        selectionListener = () => {
          if (!editor || !provider) return;
          provider.awareness.setLocalStateField("cursor", {
            anchor: editor.state.selection.anchor,
            head: editor.state.selection.head,
          });
        };
        editor.on("selectionUpdate", selectionListener);
        bridgeRemoteUpdates = (update: Uint8Array, origin: unknown) => {
          if (canEditPage || origin !== provider || disposed) return;
          const fragment = ydoc.getXmlFragment("default");
          if (!clearedLegacyContent) {
            if (fragment.length > 0) fragment.delete(0, fragment.length);
            clearedLegacyContent = true;
          }
          Y.applyUpdate(ydoc, update, provider);
        };
        if (!canEditPage) connectionDoc.on("update", bridgeRemoteUpdates);
        provider.on("status", ({ status: connectionStatus }) => {
          debugLog(
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
          if (disposed || !synced) return;
          setStatus(canEditPage ? "Connected" : "View only");
        });
        provider.on("closed", ({ code, reason }) => {
          debugLog(
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
      if (selectionListener) editor.off("selectionUpdate", selectionListener);
      awarenessRef.current = null;
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
    user,
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
          <div
            className="collaborator-presence"
            aria-label="People on this page"
          >
            {collaborators.slice(0, 5).map((person) => (
              <span
                className="collaborator-avatar"
                key={person.userId}
                title={person.name}
                style={
                  person.avatarUrl
                    ? {
                        backgroundImage: `url("${person.avatarUrl.replace(/["\\()]/g, encodeURIComponent)}")`,
                      }
                    : undefined
                }
              >
                {person.avatarUrl
                  ? null
                  : person.name
                      .split(/\s+/)
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
              </span>
            ))}
            {collaborators.length > 5 && (
              <span className="collaborator-count">
                +{collaborators.length - 5}
              </span>
            )}
          </div>
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
