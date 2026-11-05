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
  return registerTestUser({ name: "Page Tester", email: createTestEmail(prefix), password: "long-enough-password" });
}

async function createWorkspace(token: string) {
  const response = await fetch(workspacesUrl, jsonRequest("POST", token, { name: "Page test workspace" }));
  expect(response.status).toBe(201);
  return (await response.json()).data.workspace as { id: string };
}

async function createPage(workspaceId: string, token: string, title = "Project plan") {
  const response = await fetch(`${workspacesUrl}/${workspaceId}/pages`, jsonRequest("POST", token, { title }));
  expect(response.status).toBe(201);
  return (await response.json()).data.page as { id: string; workspace_id: string; title: string; created_by: string };
}

async function addMember(workspaceId: string, userId: string, role: "ADMIN" | "EDITOR" | "COMMENTER" | "VIEWER") {
  const db = await getDb();
  await db.orm.public.WorkspaceMember.create({ workspace_id: workspaceId, user_id: userId, role });
}

describe("page API", () => {
  it("creates pages and lists them for workspace members", async () => {
    const owner = await createUser("page-owner");
    const viewer = await createUser("page-viewer");
    const workspace = await createWorkspace(owner.token);
    await addMember(workspace.id, viewer.user.id, "VIEWER");
    const page = await createPage(workspace.id, owner.token);
    expect(page).toMatchObject({ title: "Project plan", workspace_id: workspace.id, created_by: owner.user.id });

    const listed = await fetch(`${workspacesUrl}/${workspace.id}/pages`, jsonRequest("GET", viewer.token));
    expect(listed.status).toBe(200);
    expect((await listed.json()).data.pages).toContainEqual(expect.objectContaining({ id: page.id }));
  });

  it("requires authentication and workspace membership to list pages", async () => {
    const owner = await createUser("page-owner");
    const outsider = await createUser("page-outsider");
    const workspace = await createWorkspace(owner.token);
    const anonymous = await fetch(`${workspacesUrl}/${workspace.id}/pages`);
    const hidden = await fetch(`${workspacesUrl}/${workspace.id}/pages`, jsonRequest("GET", outsider.token));
    expect(anonymous.status).toBe(401);
    expect(hidden.status).toBe(404);
  });

  it.each([{}, { title: "" }, { title: "x".repeat(201) }, { title: "Valid", forged: true }, null])(
    "rejects invalid page payloads %#", async (body) => {
      const owner = await createUser("page-owner");
      const workspace = await createWorkspace(owner.token);
      const response = await fetch(`${workspacesUrl}/${workspace.id}/pages`, jsonRequest("POST", owner.token, body));
      expect(response.status).toBe(400);
    },
  );

  it("rejects malformed page IDs and returns not found for missing pages", async () => {
    const owner = await createUser("page-owner");
    expect((await fetch(`${pagesUrl}/bad-id`, jsonRequest("GET", owner.token))).status).toBe(400);
    expect((await fetch(`${pagesUrl}/00000000-0000-0000-0000-000000000000`, jsonRequest("GET", owner.token))).status).toBe(404);
    const workspace = await createWorkspace(owner.token);
    expect((await fetch(`${workspacesUrl}/bad-id/pages`, jsonRequest("GET", owner.token))).status).toBe(400);
    expect((await fetch(`${workspacesUrl}/${workspace.id}/pages`, jsonRequest("POST", owner.token, { title: "Good" }))).status).toBe(201);
  });

  it("lets workspace members read a page but denies nonmembers", async () => {
    const owner = await createUser("page-owner");
    const viewer = await createUser("page-viewer");
    const outsider = await createUser("page-outsider");
    const workspace = await createWorkspace(owner.token);
    await addMember(workspace.id, viewer.user.id, "VIEWER");
    const page = await createPage(workspace.id, owner.token);
    expect((await fetch(`${pagesUrl}/${page.id}`, jsonRequest("GET", viewer.token))).status).toBe(200);
    expect((await fetch(`${pagesUrl}/${page.id}`, jsonRequest("GET", outsider.token))).status).toBe(404);
    expect((await fetch(`${pagesUrl}/${page.id}`)).status).toBe(401);
  });

  it("allows editors to update titles and rejects invalid or read-only updates", async () => {
    const owner = await createUser("page-owner");
    const editor = await createUser("page-editor");
    const viewer = await createUser("page-viewer");
    const workspace = await createWorkspace(owner.token);
    await addMember(workspace.id, editor.user.id, "EDITOR");
    await addMember(workspace.id, viewer.user.id, "VIEWER");
    const page = await createPage(workspace.id, owner.token);

    for (const body of [{}, { title: "" }, { title: "x".repeat(201) }, { title: "Hacked", workspace_id: "another" }, null]) {
      expect((await fetch(`${pagesUrl}/${page.id}`, jsonRequest("PATCH", owner.token, body))).status).toBe(400);
    }
    expect((await fetch(`${pagesUrl}/${page.id}`, jsonRequest("PATCH", viewer.token, { title: "No access" }))).status).toBe(403);
    expect((await fetch(`${pagesUrl}/${page.id}`, jsonRequest("PATCH", "bad-token", { title: "No auth" }))).status).toBe(401);

    const updated = await fetch(`${pagesUrl}/${page.id}`, jsonRequest("PATCH", editor.token, { title: "  Updated plan  " }));
    expect(updated.status).toBe(200);
    expect((await updated.json()).data.page).toMatchObject({ id: page.id, title: "Updated plan" });
  });

  it("soft deletes pages and excludes them from all page reads", async () => {
    const owner = await createUser("page-owner");
    const workspace = await createWorkspace(owner.token);
    const page = await createPage(workspace.id, owner.token);
    const deleted = await fetch(`${pagesUrl}/${page.id}`, jsonRequest("DELETE", owner.token));
    expect(deleted.status).toBe(200);
    expect((await deleted.json()).data.deleted).toBe(true);
    expect((await fetch(`${pagesUrl}/${page.id}`, jsonRequest("GET", owner.token))).status).toBe(404);
    const list = await fetch(`${workspacesUrl}/${workspace.id}/pages`, jsonRequest("GET", owner.token));
    expect((await list.json()).data.pages).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: page.id }),
    ]));
  });
});
