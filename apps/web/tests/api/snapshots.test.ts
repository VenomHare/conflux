import * as Y from "yjs";
import { getDb } from "@repo/database";
import { describe, expect, it } from "vitest";
import { apiBaseUrl, createTestEmail, registerTestUser } from "./support";

const workspacesUrl = `${apiBaseUrl}/api/v1/workspaces`;
const pagesUrl = `${apiBaseUrl}/api/v1/pages`;
const jsonRequest = (method: string, token?: string, body?: unknown) => ({
  method,
  headers: {
    ...(body !== undefined ? { "content-type": "application/json" } : {}),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

async function createUser(prefix: string) {
  return registerTestUser({ name: "History Tester", email: createTestEmail(prefix), password: "long-enough-password" });
}

async function createWorkspace(token: string) {
  const response = await fetch(workspacesUrl, jsonRequest("POST", token, { name: "History workspace" }));
  expect(response.status).toBe(201);
  return (await response.json()).data.workspace as { id: string };
}

async function createPage(workspaceId: string, token: string) {
  const response = await fetch(`${workspacesUrl}/${workspaceId}/pages`, jsonRequest("POST", token, { title: "History page" }));
  expect(response.status).toBe(201);
  return (await response.json()).data.page as { id: string };
}

async function addMember(workspaceId: string, userId: string, role: "ADMIN" | "EDITOR" | "COMMENTER" | "VIEWER") {
  const db = await getDb();
  await db.orm.public.WorkspaceMember.create({ workspace_id: workspaceId, user_id: userId, role });
}

async function saveUpdate(pageId: string, update: Uint8Array) {
  const db = await getDb();
  await db.orm.public.PageUpdate.create({ page_id: pageId, update });
}

async function readPersistedText(pageId: string) {
  const db = await getDb();
  const updates = await db.orm.public.PageUpdate.where({ page_id: pageId }).all();
  const document = new Y.Doc();
  for (const row of updates) Y.applyUpdate(document, row.update as Uint8Array);
  return document.getText("content").toString();
}

describe("version history API", () => {
  it("creates and lists binary Yjs snapshots for page members", async () => {
    const owner = await createUser("snapshot-owner");
    const viewer = await createUser("snapshot-viewer");
    const workspace = await createWorkspace(owner.token);
    await addMember(workspace.id, viewer.user.id, "VIEWER");
    const page = await createPage(workspace.id, owner.token);
    const document = new Y.Doc();
    document.getText("content").insert(0, "initial version");
    await saveUpdate(page.id, Y.encodeStateAsUpdate(document));

    const created = await fetch(`${pagesUrl}/${page.id}/snapshots`, jsonRequest("POST", owner.token, { label: "  Initial  " }));
    expect(created.status).toBe(201);
    const snapshot = (await created.json()).data.snapshot as { id: string; label: string; page_id: string };
    expect(snapshot).toMatchObject({ label: "Initial", page_id: page.id });
    expect("document_state" in snapshot).toBe(false);

    const listed = await fetch(`${pagesUrl}/${page.id}/snapshots`, jsonRequest("GET", viewer.token));
    expect(listed.status).toBe(200);
    expect((await listed.json()).data.snapshots).toContainEqual(expect.objectContaining({ id: snapshot.id }));
    const details = await fetch(`${pagesUrl}/${page.id}/snapshots/${snapshot.id}`, jsonRequest("GET", viewer.token));
    expect(details.status).toBe(200);
    const detailsBody = (await details.json()).data.snapshot;
    expect(Buffer.from(detailsBody.document_state, "base64").length).toBeGreaterThan(0);
    const restoredDoc = new Y.Doc();
    Y.applyUpdate(restoredDoc, Buffer.from(detailsBody.document_state, "base64"));
    expect(restoredDoc.getText("content").toString()).toBe("initial version");
  });

  it("requires authentication and workspace membership to read history", async () => {
    const owner = await createUser("snapshot-owner");
    const stranger = await createUser("snapshot-stranger");
    const workspace = await createWorkspace(owner.token);
    const page = await createPage(workspace.id, owner.token);
    const listUrl = `${pagesUrl}/${page.id}/snapshots`;
    expect((await fetch(listUrl)).status).toBe(401);
    expect((await fetch(listUrl, jsonRequest("GET", stranger.token))).status).toBe(404);
    expect((await fetch(`${pagesUrl}/bad-id/snapshots`, jsonRequest("GET", owner.token))).status).toBe(400);
  });

  it.each([null, { label: "" }, { label: "x".repeat(201) }, { label: "Valid", extra: true }])(
    "rejects invalid snapshot create requests %#", async (body) => {
      const owner = await createUser("snapshot-owner");
      const workspace = await createWorkspace(owner.token);
      const page = await createPage(workspace.id, owner.token);
      expect((await fetch(`${pagesUrl}/${page.id}/snapshots`, jsonRequest("POST", owner.token, body))).status).toBe(400);
    },
  );

  it("allows editors to create snapshots and blocks viewers from changing history", async () => {
    const owner = await createUser("snapshot-owner");
    const editor = await createUser("snapshot-editor");
    const viewer = await createUser("snapshot-viewer");
    const workspace = await createWorkspace(owner.token);
    await addMember(workspace.id, editor.user.id, "EDITOR");
    await addMember(workspace.id, viewer.user.id, "VIEWER");
    const page = await createPage(workspace.id, owner.token);
    const editorSnapshot = await fetch(`${pagesUrl}/${page.id}/snapshots`, jsonRequest("POST", editor.token, {}));
    expect(editorSnapshot.status).toBe(201);
    const viewerSnapshot = await fetch(`${pagesUrl}/${page.id}/snapshots`, jsonRequest("POST", viewer.token, {}));
    expect(viewerSnapshot.status).toBe(403);
    const snapshot = (await editorSnapshot.json()).data.snapshot as { id: string };
    expect((await fetch(`${pagesUrl}/${page.id}/snapshots/${snapshot.id}/restore`, jsonRequest("POST", viewer.token))).status).toBe(403);
  });

  it("rejects missing or cross-page snapshots", async () => {
    const owner = await createUser("snapshot-owner");
    const workspace = await createWorkspace(owner.token);
    const page = await createPage(workspace.id, owner.token);
    const otherPage = await createPage(workspace.id, owner.token);
    const created = await fetch(`${pagesUrl}/${page.id}/snapshots`, jsonRequest("POST", owner.token, {}));
    const snapshot = (await created.json()).data.snapshot as { id: string };
    expect((await fetch(`${pagesUrl}/${page.id}/snapshots/not-a-uuid`, jsonRequest("GET", owner.token))).status).toBe(400);
    expect((await fetch(`${pagesUrl}/${page.id}/snapshots/00000000-0000-0000-0000-000000000000`, jsonRequest("GET", owner.token))).status).toBe(404);
    expect((await fetch(`${pagesUrl}/${otherPage.id}/snapshots/${snapshot.id}`, jsonRequest("GET", owner.token))).status).toBe(404);
  });

  it("restores a version transactionally and records the pre-restore state", async () => {
    const owner = await createUser("snapshot-owner");
    const workspace = await createWorkspace(owner.token);
    const page = await createPage(workspace.id, owner.token);
    const document = new Y.Doc();
    document.getText("content").insert(0, "before restore");
    await saveUpdate(page.id, Y.encodeStateAsUpdate(document));
    const created = await fetch(`${pagesUrl}/${page.id}/snapshots`, jsonRequest("POST", owner.token, { label: "Earlier" }));
    const snapshot = (await created.json()).data.snapshot as { id: string };

    document.getText("content").insert(document.getText("content").length, " plus newer edits");
    await saveUpdate(page.id, Y.encodeStateAsUpdate(document));
    expect(await readPersistedText(page.id)).toBe("before restore plus newer edits");

    const restored = await fetch(`${pagesUrl}/${page.id}/snapshots/${snapshot.id}/restore`, jsonRequest("POST", owner.token));
    expect(restored.status).toBe(200);
    expect((await restored.json()).data.restored).toBe(true);
    expect(await readPersistedText(page.id)).toBe("before restore");
    const snapshots = await fetch(`${pagesUrl}/${page.id}/snapshots`, jsonRequest("GET", owner.token));
    expect((await snapshots.json()).data.snapshots).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Before restore" }),
    ]));
  });
});
