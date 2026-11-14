"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { api, send } from "@/lib/client-api";
import { dateLabel } from "@/components/date-label";
import type { Editor } from "@tiptap/react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Collaboration } from "@tiptap/extension-collaboration";
import * as Y from "yjs";

type CommentRecord = {
  id: string;
  page_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  anchor: Record<string, unknown>;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  author?: { id: string; name: string; avatar_url: string | null };
};
type SnapshotRecord = {
  id: string;
  page_id: string;
  created_by: string;
  label: string | null;
  created_at: string;
  document_state?: string;
  author?: { id: string; name: string; avatar_url: string | null };
};

export function PageSidePanel({
  kind,
  onClose,
  pageId,
  editor,
  doc,
  role,
  userId,
}: {
  kind: "comments" | "history";
  onClose: () => void;
  pageId: string;
  editor: Editor | null;
  doc: Y.Doc;
  role: string;
  userId: string;
}) {
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotRecord[]>([]);
  const [tab, setTab] = useState<"open" | "resolved">("open");
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [selected, setSelected] = useState<SnapshotRecord | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canWrite = ["OWNER", "ADMIN", "EDITOR", "COMMENTER"].includes(role);
  const canSave = ["OWNER", "ADMIN", "EDITOR"].includes(role);
  const canRestore = ["OWNER", "ADMIN"].includes(role);
  const loadComments = async () => {
    const result = await api<{ comments: CommentRecord[] }>(
      `/pages/${pageId}/comments`,
    );
    setComments(result.comments);
  };
  const loadSnapshots = async () => {
    const result = await api<{ snapshots: SnapshotRecord[] }>(
      `/pages/${pageId}/snapshots`,
    );
    setSnapshots(result.snapshots);
  };
  useEffect(() => {
    setError("");
    (kind === "comments" ? loadComments() : loadSnapshots()).catch((e) =>
      setError(e instanceof Error ? e.message : "Could not load panel"),
    );
    if (kind !== "history") return;
    const refreshTimer = setInterval(() => {
      void loadSnapshots().catch((e) =>
        setError(e instanceof Error ? e.message : "Could not refresh history"),
      );
    }, 30_000);
    return () => clearInterval(refreshTimer);
  }, [kind, pageId]);
  async function mutate(path: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    try {
      await api(path, send(method, body));
      await loadComments();
      setDraft("");
      setReplyTo(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save comment");
    } finally {
      setBusy(false);
    }
  }
  async function submitComment(
    parent_id?: string,
    anchor: Record<string, unknown> = {},
  ) {
    if (!draft.trim()) return;
    await mutate(`/pages/${pageId}/comments`, "POST", {
      content: draft,
      parent_id,
      anchor,
    });
  }
  async function saveSnapshot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    try {
      const bytes = Y.encodeStateAsUpdate(doc);
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000)
        binary += String.fromCharCode(
          ...bytes.subarray(offset, offset + 0x8000),
        );
      await api(
        `/pages/${pageId}/snapshots`,
        send("POST", {
          label: data.get("label") || undefined,
          document_state: btoa(binary),
        }),
      );
      await loadSnapshots();
      form.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save version");
    } finally {
      setBusy(false);
    }
  }
  async function chooseSnapshot(snapshot: SnapshotRecord) {
    setSelected(snapshot);
    setError("");
    try {
      const result = await api<{ snapshot: SnapshotRecord }>(
        `/pages/${pageId}/snapshots/${snapshot.id}`,
      );
      setSelected(result.snapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load version");
    }
  }
  async function restore() {
    if (
      !selected ||
      !window.confirm(
        "Restore this version? It will replace the current document.",
      )
    )
      return;
    console.log(
      `[restore] requested page=${pageId} snapshot=${selected.id} label=${selected.label ?? ""} created=${selected.created_at} snapshotChars=${selected.document_state?.length ?? 0} currentStateVectorBytes=${Y.encodeStateVector(doc).byteLength}`,
    );
    setBusy(true);
    setError("");
    try {
      const result = await api<{ restored: boolean }>(
        `/pages/${pageId}/snapshots/${selected.id}/restore`,
        send("POST"),
      );
      console.log(
        `[restore] response page=${pageId} snapshot=${selected.id} restored=${result.restored}`,
      );
      window.location.reload();
    } catch (e) {
      console.error(
        `[restore] request failed page=${pageId} snapshot=${selected.id}: ${String(e)}`,
      );
      setError(e instanceof Error ? e.message : "Could not restore version");
      setBusy(false);
    }
  }
  const roots = comments.filter(
    (comment) =>
      !comment.parent_id &&
      (tab === "resolved" ? !!comment.resolved_at : !comment.resolved_at),
  );
  return (
    <aside
      id="page-side-panel"
      className="page-side-panel"
      aria-labelledby="page-side-panel-title"
    >
      <header className="page-side-panel-header">
        <h2 id="page-side-panel-title">
          {kind === "comments" ? "Comments" : "Version history"}
        </h2>
        <button
          className="quiet"
          type="button"
          onClick={onClose}
          aria-label="Close panel"
        >
          ×
        </button>
      </header>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {kind === "comments" ? (
        <>
          <nav className="side-panel-tabs">
            <button
              className={tab === "open" ? "selected" : ""}
              type="button"
              aria-pressed={tab === "open"}
              onClick={() => setTab("open")}
            >
              Open
            </button>
            <button
              className={tab === "resolved" ? "selected" : ""}
              type="button"
              aria-pressed={tab === "resolved"}
              onClick={() => setTab("resolved")}
            >
              Resolved
            </button>
          </nav>
          {canWrite && (
            <form
              className="side-panel-composer"
              onSubmit={(e) => {
                e.preventDefault();
                void submitComment(
                  undefined,
                  editor?.state.selection.empty
                    ? {}
                    : {
                        quotedText: editor?.state.doc
                          .textBetween(
                            editor.state.selection.from,
                            editor.state.selection.to,
                            " ",
                          )
                          .slice(0, 200),
                      },
                );
              }}
            >
              <textarea
                aria-label="Add a comment"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Add a comment…"
                rows={3}
              />
              <button className="primary" disabled={busy || !draft.trim()}>
                Comment
              </button>
            </form>
          )}
          <div className="side-panel-list">
            {roots.length === 0 ? (
              <p className="muted">No {tab} comments yet.</p>
            ) : (
              roots.map((root) => (
                <article className="comment-thread" key={root.id}>
                  {typeof root.anchor?.quotedText === "string" && (
                    <blockquote>{root.anchor.quotedText}</blockquote>
                  )}
                  <CommentItem comment={root} />
                  {comments
                    .filter((c) => c.parent_id === root.id)
                    .map((reply) => (
                      <CommentItem key={reply.id} comment={reply} />
                    ))}
                  {canWrite &&
                    !root.resolved_at &&
                    (replyTo === root.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void submitComment(root.id);
                        }}
                      >
                        <textarea
                          autoFocus
                          aria-label="Write a reply"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder="Reply…"
                        />
                        <button className="primary" disabled={busy}>
                          Reply
                        </button>
                      </form>
                    ) : (
                      <button
                        className="quiet"
                        type="button"
                        onClick={() => {
                          setReplyTo(root.id);
                          setDraft("");
                        }}
                      >
                        Reply
                      </button>
                    ))}
                  <div className="comment-actions">
                    {root.author_id === userId ||
                    role === "ADMIN" ||
                    role === "OWNER" ? (
                      <button
                        className="quiet"
                        type="button"
                        onClick={() => {
                          const text = window.prompt(
                            "Edit comment",
                            root.content,
                          );
                          if (text?.trim())
                            void mutate(`/comments/${root.id}`, "PATCH", {
                              content: text,
                            });
                        }}
                      >
                        Edit
                      </button>
                    ) : null}
                    {(root.author_id === userId ||
                      role === "ADMIN" ||
                      role === "OWNER") && (
                      <button
                        className="quiet"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Delete this thread and its replies?",
                            )
                          )
                            void mutate(`/comments/${root.id}`, "DELETE");
                        }}
                      >
                        Delete
                      </button>
                    )}
                    {(root.author_id === userId ||
                      role === "ADMIN" ||
                      role === "OWNER") && (
                      <button
                        className="quiet"
                        type="button"
                        onClick={() =>
                          void mutate(
                            `/comments/${root.id}/${root.resolved_at ? "reopen" : "resolve"}`,
                            "PATCH",
                          )
                        }
                      >
                        {root.resolved_at ? "Reopen" : "Resolve"}
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </>
      ) : (
        <>
          {canSave && (
            <form
              className="side-panel-composer"
              onSubmit={(e) => void saveSnapshot(e)}
            >
              <input
                name="label"
                aria-label="Version label"
                maxLength={120}
                placeholder="Version label (optional)"
              />
              <button className="primary" disabled={busy}>
                Save version
              </button>
            </form>
          )}
          <div className="side-panel-list">
            {snapshots.length === 0 ? (
              <p className="muted">No saved versions yet.</p>
            ) : (
              [...snapshots]
                .sort(
                  (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
                )
                .map((s) => (
                  <button
                    className={`snapshot-row${selected?.id === s.id ? " selected" : ""}`}
                    type="button"
                    key={s.id}
                    onClick={() => void chooseSnapshot(s)}
                  >
                    <strong>{s.label || "Saved version"}</strong>
                    <span>{new Date(s.created_at).toLocaleString()}</span>
                  </button>
                ))
            )}
          </div>
          {selected && (
            <div className="snapshot-preview">
              <h3>{selected.label || "Saved version"}</h3>
              {selected.document_state ? (
                <SnapshotPreview state={selected.document_state} />
              ) : (
                <p className="muted">Loading preview…</p>
              )}
              <div className="comment-actions">
                <button
                  className="quiet"
                  type="button"
                  onClick={() => setSelected(null)}
                >
                  Back to current
                </button>
                {canRestore && (
                  <button
                    className="primary"
                    type="button"
                    disabled={busy || !selected.document_state}
                    onClick={() => void restore()}
                  >
                    Restore version
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  );
}

function CommentItem({ comment }: { comment: CommentRecord }) {
  const author = comment.author;
  const name = author?.name || "Member";
  let color = "#64748b";
  if (author?.id) {
    let hash = 0;
    for (const char of author.id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
    color = [
      "#E11D48",
      "#EA580C",
      "#CA8A04",
      "#16A34A",
      "#0891B2",
      "#2563EB",
      "#7C3AED",
      "#C026D3",
    ][Math.abs(hash) % 8];
  }
  const avatarStyle: CSSProperties = { backgroundColor: color };
  if (author?.avatar_url) {
    try {
      const url = new URL(author.avatar_url);
      if (url.protocol === "http:" || url.protocol === "https:")
        avatarStyle.backgroundImage = `url("${url.href.replace(/["\\]/g, encodeURIComponent)}")`;
    } catch {}
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <div className="comment-item">
      <div className="comment-author">
        <span className="comment-avatar" style={avatarStyle} aria-label={name}>
          {avatarStyle.backgroundImage ? null : initials}
        </span>
        <span>
          <strong>{name}</strong>
          <span className="muted"> · {dateLabel(comment.created_at)}</span>
        </span>
      </div>
      <p>{comment.content}</p>
    </div>
  );
}

function SnapshotPreview({ state }: { state: string }) {
  const previewDoc = useMemo(() => {
    const doc = new Y.Doc();
    try {
      Y.applyUpdate(
        doc,
        Uint8Array.from(atob(state), (c) => c.charCodeAt(0)),
      );
    } catch {}
    return doc;
  }, [state]);
  const previewEditor = useEditor(
    {
      extensions: [
        StarterKit.configure({ undoRedo: false }),
        Collaboration.configure({ document: previewDoc }),
      ],
      editable: false,
      immediatelyRender: false,
    },
    [previewDoc],
  );
  useEffect(() => () => previewDoc.destroy(), [previewDoc]);
  return (
    <EditorContent
      editor={previewEditor}
      className="page-editor-prose snapshot-preview-content"
    />
  );
}
