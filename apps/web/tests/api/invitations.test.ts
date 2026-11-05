import { getDb } from "@repo/database";
import { describe, expect, it } from "vitest";
import { apiBaseUrl, createTestEmail, registerTestUser } from "./support";

const workspacesUrl = `${apiBaseUrl}/api/v1/workspaces`;
const invitationsUrl = `${apiBaseUrl}/api/v1/invitations`;
const jsonRequest = (method: string, token?: string, body?: unknown) => ({
  method,
  headers: {
    ...(body !== undefined ? { "content-type": "application/json" } : {}),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

async function createUser(prefix: string) {
  return registerTestUser({ name: "Invitation Tester", email: createTestEmail(prefix), password: "long-enough-password" });
}

async function createWorkspace(token: string) {
  const response = await fetch(workspacesUrl, jsonRequest("POST", token, { name: "Invitation test workspace" }));
  expect(response.status).toBe(201);
  return (await response.json()).data.workspace as { id: string };
}

async function createInvitation(workspaceId: string, token: string, email: string, role: string = "EDITOR") {
  return fetch(`${workspacesUrl}/${workspaceId}/invitations`, jsonRequest("POST", token, { email, role }));
}

async function addMember(workspaceId: string, userId: string, role: "ADMIN" | "EDITOR" | "COMMENTER" | "VIEWER") {
  const db = await getDb();
  await db.orm.public.WorkspaceMember.create({ workspace_id: workspaceId, user_id: userId, role });
}

describe("invitation API", () => {
  it("creates an invitation and lets only the invited account inspect and accept it", async () => {
    const owner = await createUser("invite-owner");
    const invited = await createUser("invite-user");
    const stranger = await createUser("invite-stranger");
    const workspace = await createWorkspace(owner.token);
    const created = await createInvitation(workspace.id, owner.token, invited.user.email, "COMMENTER");
    expect(created.status).toBe(201);
    const invitation = (await created.json()).data.invitation as { id: string; token: string; role: string; expires_at: string };
    expect(invitation).toMatchObject({ role: "COMMENTER" });
    expect(new Date(invitation.expires_at).getTime()).toBeGreaterThan(Date.now());

    const url = `${invitationsUrl}/${invitation.token}`;
    expect((await fetch(url)).status).toBe(401);
    expect((await fetch(url, jsonRequest("GET", stranger.token))).status).toBe(404);
    const details = await fetch(url, jsonRequest("GET", invited.token));
    expect(details.status).toBe(200);
    expect((await details.json()).data).toMatchObject({
      invitation: { id: invitation.id, email: invited.user.email, role: "COMMENTER" },
      workspace: { id: workspace.id, name: "Invitation test workspace" },
    });

    const accepted = await fetch(`${url}/accept`, jsonRequest("POST", invited.token));
    expect(accepted.status).toBe(201);
    expect((await accepted.json()).data.member).toMatchObject({ user_id: invited.user.id, role: "COMMENTER" });
    expect((await fetch(url, jsonRequest("GET", invited.token))).status).toBe(404);
    expect((await fetch(`${url}/accept`, jsonRequest("POST", invited.token))).status).toBe(409);
  });

  it.each([
    {}, { email: "not-an-email", role: "EDITOR" }, { email: "user@example.test", role: "OWNER" },
    { email: "user@example.test", role: "EDITOR", extra: true }, null,
  ])("rejects invalid invitation data %#", async (body) => {
    const owner = await createUser("invite-owner");
    const workspace = await createWorkspace(owner.token);
    const response = await fetch(`${workspacesUrl}/${workspace.id}/invitations`, jsonRequest("POST", owner.token, body));
    expect(response.status).toBe(400);
  });

  it("requires workspace manager access to create invitations", async () => {
    const owner = await createUser("invite-owner");
    const viewer = await createUser("invite-viewer");
    const stranger = await createUser("invite-stranger");
    const workspace = await createWorkspace(owner.token);
    await addMember(workspace.id, viewer.user.id, "VIEWER");

    const unauthenticated = await fetch(`${workspacesUrl}/${workspace.id}/invitations`, jsonRequest("POST", undefined, { email: stranger.user.email, role: "VIEWER" }));
    const forbidden = await createInvitation(workspace.id, viewer.token, stranger.user.email, "VIEWER");
    const hidden = await createInvitation(workspace.id, stranger.token, stranger.user.email, "VIEWER");
    expect(unauthenticated.status).toBe(401);
    expect(forbidden.status).toBe(403);
    expect(hidden.status).toBe(404);
  });

  it("prevents admins from granting admin role and rejects invitations to existing members", async () => {
    const owner = await createUser("invite-owner");
    const admin = await createUser("invite-admin");
    const member = await createUser("invite-member");
    const workspace = await createWorkspace(owner.token);
    await addMember(workspace.id, admin.user.id, "ADMIN");
    await addMember(workspace.id, member.user.id, "EDITOR");

    expect((await createInvitation(workspace.id, admin.token, "newperson@example.test", "ADMIN")).status).toBe(403);
    expect((await createInvitation(workspace.id, owner.token, member.user.email, "VIEWER")).status).toBe(409);
  });

  it("rejects unknown, malformed, expired, and mismatched invitation tokens", async () => {
    const owner = await createUser("invite-owner");
    const invited = await createUser("invite-user");
    const stranger = await createUser("invite-stranger");
    const workspace = await createWorkspace(owner.token);
    const response = await createInvitation(workspace.id, owner.token, invited.user.email);
    const invitation = (await response.json()).data.invitation as { id: string; token: string };

    expect((await fetch(`${invitationsUrl}/bad`, jsonRequest("GET", invited.token))).status).toBe(404);
    expect((await fetch(`${invitationsUrl}/not-a-real-token-12345678901234567890`, jsonRequest("GET", invited.token))).status).toBe(404);
    expect((await fetch(`${invitationsUrl}/${invitation.token}/accept`, jsonRequest("POST", stranger.token))).status).toBe(404);

    const db = await getDb();
    await db.orm.public.Invitation.where({ id: invitation.id }).update({ expires_at: new Date(Date.now() - 60_000).toISOString() });
    expect((await fetch(`${invitationsUrl}/${invitation.token}`, jsonRequest("GET", invited.token))).status).toBe(404);
    expect((await fetch(`${invitationsUrl}/${invitation.token}/accept`, jsonRequest("POST", invited.token))).status).toBe(410);
  });

  it("allows workspace managers to revoke pending invitations and blocks other users", async () => {
    const owner = await createUser("invite-owner");
    const viewer = await createUser("invite-viewer");
    const stranger = await createUser("invite-stranger");
    const recipient = await createUser("invite-recipient");
    const workspace = await createWorkspace(owner.token);
    await addMember(workspace.id, viewer.user.id, "VIEWER");
    const response = await createInvitation(workspace.id, owner.token, recipient.user.email);
    const invitation = (await response.json()).data.invitation as { id: string };
    const url = `${workspacesUrl}/${workspace.id}/invitations/${invitation.id}`;

    expect((await fetch(url, jsonRequest("DELETE", viewer.token))).status).toBe(403);
    expect((await fetch(url, jsonRequest("DELETE", stranger.token))).status).toBe(404);
    expect((await fetch(url, jsonRequest("DELETE"))).status).toBe(401);
    expect((await fetch(url, jsonRequest("DELETE", owner.token))).status).toBe(200);
    expect((await fetch(url, jsonRequest("DELETE", owner.token))).status).toBe(404);
  });

  it("prevents revocation through another workspace or of an accepted invitation", async () => {
    const owner = await createUser("invite-owner");
    const invitee = await createUser("invitee");
    const workspace = await createWorkspace(owner.token);
    const otherWorkspace = await createWorkspace(owner.token);
    const response = await createInvitation(workspace.id, owner.token, invitee.user.email);
    const invitation = (await response.json()).data.invitation as { id: string; token: string };
    expect((await fetch(`${workspacesUrl}/${otherWorkspace.id}/invitations/${invitation.id}`, jsonRequest("DELETE", owner.token))).status).toBe(404);
    await fetch(`${invitationsUrl}/${invitation.token}/accept`, jsonRequest("POST", invitee.token));
    expect((await fetch(`${workspacesUrl}/${workspace.id}/invitations/${invitation.id}`, jsonRequest("DELETE", owner.token))).status).toBe(409);
  });
});
