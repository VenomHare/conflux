import { describe, expect, it } from "vitest";
import { apiBaseUrl, createTestEmail, registerTestUser } from "./support";
import { getDb } from "@repo/database";

const workspacesUrl = `${apiBaseUrl}/api/v1/workspaces`;
const pagesUrl = `${apiBaseUrl}/api/v1/pages`;
const commentsUrl = `${apiBaseUrl}/api/v1/comments`;
const jsonRequest = (method: string, token?: string, body?: unknown) => ({
  method,
  headers: {
    ...(body !== undefined ? { "content-type": "application/json" } : {}),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

async function createUser(prefix: string) {
  return registerTestUser({ name: "Comment Tester", email: createTestEmail(prefix), password: "long-enough-password" });
}

async function createWorkspace(token: string) {
  const response = await fetch(workspacesUrl, jsonRequest("POST", token, { name: "Comment test workspace" }));
  expect(response.status).toBe(201);
  return (await response.json()).data.workspace as { id: string };
}

async function createPage(workspaceId: string, token: string, title: string) {
  const response = await fetch(`${workspacesUrl}/${workspaceId}/pages`, jsonRequest("POST", token, { title }));
  expect(response.status).toBe(201);
  return (await response.json()).data.page as { id: string };
}

async function createComment(pageId: string, token: string, content = "Please review this section", parent_id?: string) {
  const response = await fetch(`${pagesUrl}/${pageId}/comments`, jsonRequest("POST", token, {
    content, anchor: { from: 12, to: 18 }, ...(parent_id ? { parent_id } : {}),
  }));
  expect(response.status).toBe(201);
  return (await response.json()).data.comment as { id: string; content: string; author_id: string; page_id: string; resolved_at: string | null };
}

async function addMember(workspaceId: string, userId: string, role: "ADMIN" | "EDITOR" | "COMMENTER" | "VIEWER") {
  const db = await getDb();
  await db.orm.public.WorkspaceMember.create({ workspace_id: workspaceId, user_id: userId, role });
}

describe("comment API", () => {
  it("creates comments and threaded replies, then lists them for page members", async () => {
    const owner = await createUser("comment-owner");
    const commenter = await createUser("commenter");
    const workspace = await createWorkspace(owner.token);
    await addMember(workspace.id, commenter.user.id, "COMMENTER");
    const page = await createPage(workspace.id, owner.token, "Discussion page");
    const root = await createComment(page.id, commenter.token);
    const reply = await createComment(page.id, owner.token, "I will update this", root.id);
    expect(root).toMatchObject({ page_id: page.id, author_id: commenter.user.id, resolved_at: null });
    expect(reply).toMatchObject({ parent_id: root.id, author_id: owner.user.id });

    const list = await fetch(`${pagesUrl}/${page.id}/comments`, jsonRequest("GET", commenter.token));
    expect(list.status).toBe(200);
    expect((await list.json()).data.comments).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: root.id }), expect.objectContaining({ id: reply.id }),
    ]));
    const details = await fetch(`${commentsUrl}/${root.id}`, jsonRequest("GET", owner.token));
    expect(details.status).toBe(200);
    expect((await details.json()).data.comment.id).toBe(root.id);
  });

  it("rejects missing authentication and hides comments from users outside the workspace", async () => {
    const owner = await createUser("comment-owner");
    const stranger = await createUser("comment-stranger");
    const workspace = await createWorkspace(owner.token);
    const page = await createPage(workspace.id, owner.token, "Private page");
    const comment = await createComment(page.id, owner.token);

    expect((await fetch(`${pagesUrl}/${page.id}/comments`)).status).toBe(401);
    expect((await fetch(`${pagesUrl}/${page.id}/comments`, jsonRequest("GET", stranger.token))).status).toBe(404);
    expect((await fetch(`${commentsUrl}/${comment.id}`, jsonRequest("GET", stranger.token))).status).toBe(404);
    expect((await fetch(`${commentsUrl}/${comment.id}`)).status).toBe(401);
  });

  it.each([
    {}, { content: "", anchor: {} }, { content: "valid", anchor: "not-an-object" },
    { content: "x".repeat(10_001), anchor: {} },
    { content: "valid", anchor: {}, unexpected: true }, null,
  ])("rejects invalid comment bodies %#", async (body) => {
    const owner = await createUser("comment-owner");
    const workspace = await createWorkspace(owner.token);
    const page = await createPage(workspace.id, owner.token, "Input page");
    const response = await fetch(`${pagesUrl}/${page.id}/comments`, jsonRequest("POST", owner.token, body));
    expect(response.status).toBe(400);
  });

  it("requires commenter access to create comments and validates page and parent IDs", async () => {
    const owner = await createUser("comment-owner");
    const viewer = await createUser("comment-viewer");
    const workspace = await createWorkspace(owner.token);
    await addMember(workspace.id, viewer.user.id, "VIEWER");
    const page = await createPage(workspace.id, owner.token, "Role page");
    const body = { content: "A comment", anchor: {} };

    expect((await fetch(`${pagesUrl}/${page.id}/comments`, jsonRequest("POST", viewer.token, body))).status).toBe(403);
    expect((await fetch(`${pagesUrl}/bad-id/comments`, jsonRequest("POST", owner.token, body))).status).toBe(400);
    expect((await fetch(`${pagesUrl}/${page.id}/comments`, jsonRequest("POST", owner.token, { ...body, parent_id: "bad-id" }))).status).toBe(400);

    const otherPage = await createPage(workspace.id, owner.token, "Other page");
    const otherComment = await createComment(otherPage.id, owner.token);
    const crossPageReply = await fetch(`${pagesUrl}/${page.id}/comments`, jsonRequest("POST", owner.token, { ...body, parent_id: otherComment.id }));
    expect(crossPageReply.status).toBe(400);
  });

  it("lets authors edit their comments and restricts edits by other commenters", async () => {
    const owner = await createUser("comment-owner");
    const commenter = await createUser("commenter");
    const other = await createUser("comment-other");
    const workspace = await createWorkspace(owner.token);
    await addMember(workspace.id, commenter.user.id, "COMMENTER");
    await addMember(workspace.id, other.user.id, "COMMENTER");
    const page = await createPage(workspace.id, owner.token, "Edit page");
    const comment = await createComment(page.id, commenter.token);

    expect((await fetch(`${commentsUrl}/${comment.id}`, jsonRequest("PATCH", other.token, { content: "No" }))).status).toBe(403);
    for (const body of [{}, { content: "" }, { content: "x".repeat(10_001) }, { anchor: [] }, { content: "No", author_id: owner.user.id }, null]) {
      expect((await fetch(`${commentsUrl}/${comment.id}`, jsonRequest("PATCH", commenter.token, body))).status).toBe(400);
    }
    const updated = await fetch(`${commentsUrl}/${comment.id}`, jsonRequest("PATCH", commenter.token, { content: "  Updated comment  " }));
    expect(updated.status).toBe(200);
    expect((await updated.json()).data.comment).toMatchObject({ id: comment.id, content: "Updated comment", author_id: commenter.user.id });
    const moderated = await fetch(`${commentsUrl}/${comment.id}`, jsonRequest("PATCH", owner.token, { anchor: { from: 20, to: 24 } }));
    expect(moderated.status).toBe(200);
  });

  it("lets authors resolve and reopen comments while restricting other commenters", async () => {
    const owner = await createUser("comment-owner");
    const commenter = await createUser("commenter");
    const other = await createUser("comment-other");
    const workspace = await createWorkspace(owner.token);
    await addMember(workspace.id, commenter.user.id, "COMMENTER");
    await addMember(workspace.id, other.user.id, "COMMENTER");
    const page = await createPage(workspace.id, owner.token, "Resolve page");
    const comment = await createComment(page.id, commenter.token);

    expect((await fetch(`${commentsUrl}/${comment.id}/resolve`, jsonRequest("PATCH", other.token))).status).toBe(403);
    const resolved = await fetch(`${commentsUrl}/${comment.id}/resolve`, jsonRequest("PATCH", commenter.token));
    expect(resolved.status).toBe(200);
    expect((await resolved.json()).data.comment.resolved_at).toBeTruthy();
    const reopened = await fetch(`${commentsUrl}/${comment.id}/reopen`, jsonRequest("PATCH", commenter.token));
    expect(reopened.status).toBe(200);
    expect((await reopened.json()).data.comment.resolved_at).toBeNull();
  });

  it("allows authors and workspace managers to delete comments", async () => {
    const owner = await createUser("comment-owner");
    const commenter = await createUser("commenter");
    const other = await createUser("comment-other");
    const workspace = await createWorkspace(owner.token);
    await addMember(workspace.id, commenter.user.id, "COMMENTER");
    await addMember(workspace.id, other.user.id, "COMMENTER");
    const page = await createPage(workspace.id, owner.token, "Delete page");
    const comment = await createComment(page.id, commenter.token);

    expect((await fetch(`${commentsUrl}/${comment.id}`, jsonRequest("DELETE", other.token))).status).toBe(403);
    expect((await fetch(`${commentsUrl}/${comment.id}`, jsonRequest("DELETE", commenter.token))).status).toBe(200);
    expect((await fetch(`${commentsUrl}/${comment.id}`, jsonRequest("GET", owner.token))).status).toBe(404);

    const moderatedComment = await createComment(page.id, commenter.token, "Manager can remove");
    expect((await fetch(`${commentsUrl}/${moderatedComment.id}`, jsonRequest("DELETE", owner.token))).status).toBe(200);
  });
});
