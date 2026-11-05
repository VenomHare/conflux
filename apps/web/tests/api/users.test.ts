import { beforeAll, describe, expect, it } from "vitest";
import { authUrl, createTestEmail, postJson, registerTestUser, usersUrl } from "./support";

const patchJson = (token: string, body: unknown) => fetch(`${usersUrl}/me`, {
  method: "PATCH",
  headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
  body: JSON.stringify(body),
});

async function createUser() {
  return registerTestUser({
    name: "Test User", email: createTestEmail("users"), password: "long-enough-password",
  });
}

let validationAccount: Awaited<ReturnType<typeof createUser>>;

beforeAll(async () => {
  validationAccount = await createUser();
});

describe("user API", () => {
  it("returns the authenticated user's profile", async () => {
    const account = await createUser();
    const response = await fetch(`${usersUrl}/me`, { headers: { authorization: `Bearer ${account.token}` } });
    expect(response.status).toBe(200);
    expect((await response.json()).data.user).toMatchObject({ id: account.user.id, email: account.user.email });
  });

  it("denies profile reads and updates without authentication", async () => {
    const read = await fetch(`${usersUrl}/me`);
    const update = await patchJson("invalid-token", { name: "Changed" });
    expect(read.status).toBe(401);
    expect(update.status).toBe(401);
    expect(await read.json()).toMatchObject({ error: { code: "unauthorized" } });
    expect(await update.json()).toMatchObject({ error: { code: "unauthorized" } });
  });

  it("updates the signed-in user's profile and preserves unmodified fields", async () => {
    const account = await createUser();
    const response = await patchJson(account.token, { name: "  Ada Lovelace  " });
    expect(response.status).toBe(200);
    expect((await response.json()).data.user).toMatchObject({
      id: account.user.id, email: account.user.email, name: "Ada Lovelace",
    });
  });

  it.each([
    {}, { name: "" }, { name: "x".repeat(101) },
    { avatar_url: "javascript:alert(1)" }, { avatar_url: "data:text/plain,hello" },
    { name: "New name", userId: "another-user" }, null,
  ])("rejects invalid profile updates %#", async (body) => {
    const response = await patchJson(validationAccount.token, body);
    expect(response.status).toBe(400);
  });

  it("rejects non JSON, malformed JSON, and oversized profile updates", async () => {
    const headers = { authorization: `Bearer ${validationAccount.token}` };
    const nonJson = await fetch(`${usersUrl}/me`, {
      method: "PATCH", headers: { ...headers, "content-type": "text/plain" }, body: "{}",
    });
    const malformed = await fetch(`${usersUrl}/me`, {
      method: "PATCH", headers: { ...headers, "content-type": "application/json" }, body: "{",
    });
    const oversized = await patchJson(validationAccount.token, { name: "x".repeat(16_500) });
    expect(nonJson.status).toBe(400);
    expect(malformed.status).toBe(400);
    expect(oversized.status).toBe(400);
  });

  it("rejects a forged attempt to target a different user's profile", async () => {
    const owner = await createUser();
    const other = await createUser();
    const update = await patchJson(owner.token, { name: "Changed", userId: other.user.id });
    expect(update.status).toBe(400);

    const ownerProfile = await fetch(`${usersUrl}/me`, { headers: { authorization: `Bearer ${owner.token}` } });
    expect((await ownerProfile.json()).data.user.name).toBe(owner.user.name);
  });

  it("requires authentication before resolving a user id", async () => {
    const response = await fetch(`${usersUrl}/00000000-0000-0000-0000-000000000000`);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "unauthorized" } });
  });

  it("returns not found for a nonexistent user after authentication", async () => {
    const account = await createUser();
    const response = await fetch(`${usersUrl}/00000000-0000-0000-0000-000000000000`, {
      headers: { authorization: `Bearer ${account.token}` },
    });
    expect(response.status).toBe(404);
  });
});
