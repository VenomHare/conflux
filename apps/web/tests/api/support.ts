import { afterAll, expect } from "vitest";
import { getDb } from "@repo/database";

export const apiBaseUrl = (process.env.API_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const authUrl = `${apiBaseUrl}/api/v1/auth`;
export const usersUrl = `${apiBaseUrl}/api/v1/users`;

const testEmails = new Set<string>();

export function createTestEmail(prefix: string) {
  const email = `${prefix}-${crypto.randomUUID()}@example.test`;
  testEmails.add(email);
  return email;
}

export async function postJson(url: string, body: unknown) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function registerTestUser(input: { name: string; email: string; password: string }) {
  // Register can normalize email, so cleanup must use the canonical value.
  testEmails.add(input.email.trim().toLowerCase());
  const response = await postJson(`${authUrl}/register`, input);
  const payload = await response.json();
  expect(response.status, JSON.stringify(payload)).toBe(201);
  return payload.data as {
    token: string;
    user: { id: string; name: string; email: string; avatar_url: string | null };
  };
}

afterAll(async () => {
  if (testEmails.size === 0) return;

  const db = await getDb();
  try {
    for (const email of testEmails) {
      const user = await db.orm.public.User.where({ email }).first();
      if (user) {
        // Remove workspaces before their owner so the owner FK cannot block cleanup.
        const workspaces = await db.orm.public.Workspace.where({ owner_id: user.id }).all();
        for (const workspace of workspaces) {
          await db.orm.public.Workspace.where({ id: workspace.id }).delete();
        }
        await db.orm.public.User.where({ email }).delete();
      }
    }
  } finally {
    await db.close();
  }
});
