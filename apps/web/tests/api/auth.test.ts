import { describe, expect, it } from "vitest";
import { authUrl, createTestEmail, postJson, registerTestUser } from "./support";

describe("auth API", () => {
  it("registers an account, normalizes its email, and omits credentials", async () => {
    const email = createTestEmail("register").toUpperCase();
    const result = await registerTestUser({ name: " Ada ", email, password: "long-enough-password" });

    expect(result.user.email).toBe(email.toLowerCase());
    expect(result.user.name).toBe("Ada");
    expect(result).toHaveProperty("token");
    expect(result.user).not.toHaveProperty("password_hash");
  });

  it.each([
    [{ name: "", email: "valid@example.test", password: "long-enough-password" }, "validation_error"],
    [{ name: "Ada", email: "not-an-email", password: "long-enough-password" }, "validation_error"],
    [{ name: "Ada", email: "valid@example.test", password: "short" }, "validation_error"],
    [{ name: "Ada", email: "valid@example.test", password: "long-enough-password", role: "admin" }, "validation_error"],
    [null, "invalid_request"],
  ])("rejects invalid registration input %#", async (body, expectedCode) => {
    const response = await postJson(`${authUrl}/register`, body);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: expectedCode } });
  });

  it("rejects non JSON and malformed JSON registration requests", async () => {
    const nonJson = await fetch(`${authUrl}/register`, {
      method: "POST", headers: { "content-type": "text/plain" }, body: "{}",
    });
    const malformed = await fetch(`${authUrl}/register`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{",
    });
    expect(nonJson.status).toBe(400);
    expect(malformed.status).toBe(400);
  });

  it("rejects a duplicate email", async () => {
    const email = createTestEmail("duplicate");
    const input = { name: "Ada", email, password: "long-enough-password" };
    await registerTestUser(input);

    const duplicate = await postJson(`${authUrl}/register`, input);
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toMatchObject({ error: { code: "email_unavailable" } });
  });

  it("logs in with valid credentials and rejects an incorrect password", async () => {
    const input = { name: "Ada", email: createTestEmail("login"), password: "long-enough-password" };
    const account = await registerTestUser(input);

    const valid = await postJson(`${authUrl}/login`, { email: input.email.toUpperCase(), password: input.password });
    expect(valid.status).toBe(200);
    expect((await valid.json()).data.user.id).toBe(account.user.id);

    const invalid = await postJson(`${authUrl}/login`, { email: input.email, password: "incorrect-password" });
    expect(invalid.status).toBe(401);
    expect(await invalid.json()).toMatchObject({ error: { code: "invalid_credentials" } });
  });

  it("uses the same unauthorized response for an unknown email", async () => {
    const response = await postJson(`${authUrl}/login`, {
      email: createTestEmail("unknown"), password: "long-enough-password",
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_credentials" } });
  });

  it.each([
    [{ email: "bad", password: "secret" }],
    [{ email: "valid@example.test", password: "" }],
    [{ email: "valid@example.test", password: "x".repeat(73) }],
    [{ email: "valid@example.test", password: "long-enough-password", extra: true }],
  ])("rejects invalid login input %#", async (body) => {
    const response = await postJson(`${authUrl}/login`, body);
    expect(response.status).toBe(400);
  });

  it("denies the auth identity endpoint without a valid session", async () => {
    const response = await fetch(`${authUrl}/me`);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "unauthorized" } });
  });
});
