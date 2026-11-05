import { describe, expect, it } from "vitest";
import { createTestEmail, registerTestUser, apiBaseUrl } from "./support";

const workspacesUrl = `${apiBaseUrl}/api/v1/workspaces`;
const jsonRequest = (method: string, token?: string, body?: unknown) => ({
  method,
  headers: {
    ...(body !== undefined ? { "content-type": "application/json" } : {}),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

async function createUser(prefix = "workspaces") {
  return registerTestUser({
    name: "Workspace Tester", email: createTestEmail(prefix), password: "long-enough-password",
  });
}

async function createWorkspace(token: string, name = "Design team") {
  const response = await fetch(workspacesUrl, jsonRequest("POST", token, { name, description: "Shared work" }));
  expect(response.status).toBe(201);
  return (await response.json()).data.workspace as { id: string; name: string; description: string; owner_id: string };
}

describe("workspace API", () => {
  it("creates a workspace with its owner membership and lists the user's workspaces", async () => {
    const account = await createUser();
    const workspace = await createWorkspace(account.token);
    expect(workspace).toMatchObject({ name: "Design team", description: "Shared work", owner_id: account.user.id });

    const response = await fetch(workspacesUrl, jsonRequest("GET", account.token));
    expect(response.status).toBe(200);
    expect((await response.json()).data.workspaces).toContainEqual(expect.objectContaining({ id: workspace.id }));
  });

  it("requires authentication for collection and item access", async () => {
    const account = await createUser();
    const workspace = await createWorkspace(account.token);
    const responses = await Promise.all([
      fetch(workspacesUrl, jsonRequest("GET")),
      fetch(workspacesUrl, jsonRequest("POST", undefined, { name: "No auth" })),
      fetch(`${workspacesUrl}/${workspace.id}`, jsonRequest("GET")),
      fetch(`${workspacesUrl}/${workspace.id}`, jsonRequest("PATCH", undefined, { name: "No auth" })),
      fetch(`${workspacesUrl}/${workspace.id}`, jsonRequest("DELETE")),
    ]);
    expect(responses.map(({ status }) => status)).toEqual([401, 401, 401, 401, 401]);
  });

  it.each([
    {}, { name: "" }, { name: "x".repeat(101) }, { name: "Valid", unexpected: true }, null,
  ])("rejects invalid workspace creation payload %#", async (body) => {
    const account = await createUser();
    const response = await fetch(workspacesUrl, jsonRequest("POST", account.token, body));
    expect(response.status).toBe(400);
  });

  it("rejects malformed or non JSON workspace writes", async () => {
    const account = await createUser();
    const nonJson = await fetch(workspacesUrl, {
      method: "POST", headers: { authorization: `Bearer ${account.token}`, "content-type": "text/plain" }, body: "{}",
    });
    const malformed = await fetch(workspacesUrl, {
      method: "POST", headers: { authorization: `Bearer ${account.token}`, "content-type": "application/json" }, body: "{",
    });
    expect(nonJson.status).toBe(400);
    expect(malformed.status).toBe(400);
  });

  it("returns not found for invalid, missing, or another user's workspace", async () => {
    const owner = await createUser("workspace-owner");
    const stranger = await createUser("workspace-stranger");
    const workspace = await createWorkspace(owner.token);
    const invalidId = await fetch(`${workspacesUrl}/not-a-uuid`, jsonRequest("GET", owner.token));
    const missing = await fetch(`${workspacesUrl}/00000000-0000-0000-0000-000000000000`, jsonRequest("GET", owner.token));
    const hidden = await fetch(`${workspacesUrl}/${workspace.id}`, jsonRequest("GET", stranger.token));
    expect(invalidId.status).toBe(400);
    expect(missing.status).toBe(404);
    expect(hidden.status).toBe(404);
    expect(await hidden.json()).toMatchObject({ error: { code: "not_found" } });
  });

  it("updates only allowed fields and rejects empty or forged updates", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner.token);
    for (const body of [{}, { name: "x".repeat(101) }, { owner_id: "forged" }, null]) {
      const invalid = await fetch(`${workspacesUrl}/${workspace.id}`, jsonRequest("PATCH", owner.token, body));
      expect(invalid.status).toBe(400);
    }
    const updated = await fetch(`${workspacesUrl}/${workspace.id}`, jsonRequest("PATCH", owner.token, { name: "  Updated  " }));
    expect(updated.status).toBe(200);
    expect((await updated.json()).data.workspace).toMatchObject({ id: workspace.id, name: "Updated", owner_id: owner.user.id });
  });

  it("does not allow a stranger to update or delete a workspace", async () => {
    const owner = await createUser("workspace-owner");
    const stranger = await createUser("workspace-stranger");
    const workspace = await createWorkspace(owner.token);
    const update = await fetch(`${workspacesUrl}/${workspace.id}`, jsonRequest("PATCH", stranger.token, { name: "Hacked" }));
    const deletion = await fetch(`${workspacesUrl}/${workspace.id}`, jsonRequest("DELETE", stranger.token));
    expect(update.status).toBe(404);
    expect(deletion.status).toBe(404);

    const stillThere = await fetch(`${workspacesUrl}/${workspace.id}`, jsonRequest("GET", owner.token));
    expect(stillThere.status).toBe(200);
    expect((await stillThere.json()).data.workspace.name).toBe("Design team");
  });

  it("deletes an owned workspace and confirms it can no longer be read", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner.token);
    const deleted = await fetch(`${workspacesUrl}/${workspace.id}`, jsonRequest("DELETE", owner.token));
    expect(deleted.status).toBe(200);
    expect((await deleted.json()).data.deleted).toBe(true);
    const missing = await fetch(`${workspacesUrl}/${workspace.id}`, jsonRequest("GET", owner.token));
    expect(missing.status).toBe(404);
  });
});
