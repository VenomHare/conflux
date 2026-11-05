import { getDb } from "@repo/database";
import { describe, expect, it } from "vitest";
import { apiBaseUrl, createTestEmail, registerTestUser } from "./support";

const workspacesUrl = `${apiBaseUrl}/api/v1/workspaces`;
const jsonRequest = (method: string, token?: string, body?: unknown) => ({
  method,
  headers: {
    ...(body !== undefined ? { "content-type": "application/json" } : {}),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

async function createUser(prefix: string) {
  return registerTestUser({ name: "Member Tester", email: createTestEmail(prefix), password: "long-enough-password" });
}

async function createWorkspace(token: string) {
  const response = await fetch(workspacesUrl, jsonRequest("POST", token, { name: "Member test workspace" }));
  expect(response.status).toBe(201);
  return (await response.json()).data.workspace as { id: string };
}

async function addMember(workspaceId: string, userId: string, role: "ADMIN" | "EDITOR" | "COMMENTER" | "VIEWER") {
  const db = await getDb();
  await db.orm.public.WorkspaceMember.create({ workspace_id: workspaceId, user_id: userId, role });
}

describe("workspace member API", () => {
  it("lets any workspace member view the roster but hides it from nonmembers", async () => {
    const owner = await createUser("member-owner");
    const viewer = await createUser("member-viewer");
    const stranger = await createUser("member-stranger");
    const workspace = await createWorkspace(owner.token);
    await addMember(workspace.id, viewer.user.id, "VIEWER");

    const roster = await fetch(`${workspacesUrl}/${workspace.id}/members`, jsonRequest("GET", viewer.token));
    expect(roster.status).toBe(200);
    expect((await roster.json()).data.members).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: "OWNER", user: expect.objectContaining({ id: owner.user.id }) }),
      expect.objectContaining({ role: "VIEWER", user: expect.objectContaining({ id: viewer.user.id }) }),
    ]));
    const hidden = await fetch(`${workspacesUrl}/${workspace.id}/members`, jsonRequest("GET", stranger.token));
    expect(hidden.status).toBe(404);
  });

  it("requires a valid authenticated workspace member to view members", async () => {
    const owner = await createUser("member-owner");
    const workspace = await createWorkspace(owner.token);
    const [anonymous, invalidId] = await Promise.all([
      fetch(`${workspacesUrl}/${workspace.id}/members`),
      fetch(`${workspacesUrl}/bad-id/members`, jsonRequest("GET", owner.token)),
    ]);
    expect(anonymous.status).toBe(401);
    expect(invalidId.status).toBe(400);
  });

  it("allows owner/admin role changes and rejects invalid roles and member identifiers", async () => {
    const owner = await createUser("member-owner");
    const editor = await createUser("member-editor");
    const workspace = await createWorkspace(owner.token);
    await addMember(workspace.id, editor.user.id, "EDITOR");
    const memberUrl = `${workspacesUrl}/${workspace.id}/members/${editor.user.id}`;

    for (const body of [{}, { role: "OWNER" }, { role: "SUPERUSER" }, { role: "VIEWER", extra: true }, null]) {
      const invalid = await fetch(memberUrl, jsonRequest("PATCH", owner.token, body));
      expect(invalid.status).toBe(400);
    }
    const invalidId = await fetch(`${workspacesUrl}/${workspace.id}/members/nope`, jsonRequest("PATCH", owner.token, { role: "VIEWER" }));
    expect(invalidId.status).toBe(400);

    const updated = await fetch(memberUrl, jsonRequest("PATCH", owner.token, { role: "COMMENTER" }));
    expect(updated.status).toBe(200);
    expect((await updated.json()).data.member).toMatchObject({ user_id: editor.user.id, role: "COMMENTER" });
  });

  it("prevents non-admin members and outsiders from managing members", async () => {
    const owner = await createUser("member-owner");
    const viewer = await createUser("member-viewer");
    const outsider = await createUser("member-outsider");
    const workspace = await createWorkspace(owner.token);
    await addMember(workspace.id, viewer.user.id, "VIEWER");
    const targetUrl = `${workspacesUrl}/${workspace.id}/members/${owner.user.id}`;

    for (const token of [viewer.token, outsider.token]) {
      const update = await fetch(targetUrl, jsonRequest("PATCH", token, { role: "VIEWER" }));
      const deletion = await fetch(targetUrl, jsonRequest("DELETE", token));
      expect(update.status).toBe(token === outsider.token ? 404 : 403);
      expect(deletion.status).toBe(token === outsider.token ? 404 : 403);
    }
    const anonymous = await fetch(targetUrl, jsonRequest("DELETE"));
    expect(anonymous.status).toBe(401);
  });

  it("does not let managers change or remove the owner, and removes ordinary members", async () => {
    const owner = await createUser("member-owner");
    const editor = await createUser("member-editor");
    const workspace = await createWorkspace(owner.token);
    await addMember(workspace.id, editor.user.id, "EDITOR");

    const ownerUrl = `${workspacesUrl}/${workspace.id}/members/${owner.user.id}`;
    const changeOwner = await fetch(ownerUrl, jsonRequest("PATCH", owner.token, { role: "VIEWER" }));
    const removeOwner = await fetch(ownerUrl, jsonRequest("DELETE", owner.token));
    expect(changeOwner.status).toBe(403);
    expect(removeOwner.status).toBe(403);

    const removed = await fetch(`${workspacesUrl}/${workspace.id}/members/${editor.user.id}`, jsonRequest("DELETE", owner.token));
    expect(removed.status).toBe(200);
    expect((await removed.json()).data.removed).toBe(true);
    const roster = await fetch(`${workspacesUrl}/${workspace.id}/members`, jsonRequest("GET", owner.token));
    expect((await roster.json()).data.members).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ user: expect.objectContaining({ id: editor.user.id }) }),
    ]));
  });

  it("returns not found for member ids outside this workspace", async () => {
    const owner = await createUser("member-owner");
    const stranger = await createUser("member-stranger");
    const workspace = await createWorkspace(owner.token);
    const url = `${workspacesUrl}/${workspace.id}/members/${stranger.user.id}`;
    expect((await fetch(url, jsonRequest("PATCH", owner.token, { role: "VIEWER" }))).status).toBe(404);
    expect((await fetch(url, jsonRequest("DELETE", owner.token))).status).toBe(404);
  });
});
