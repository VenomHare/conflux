import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcrypt";
import { getDb } from "@repo/database";

const SESSION_TTL_SECONDS = 60 * 60 * 24;
const BCRYPT_COST = 12;
const dummyPasswordHash = bcrypt.hash("not-a-real-account-password", BCRYPT_COST);

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type StoredUser = PublicUser & { password_hash: string };

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32 || value.startsWith("replace-with-")) {
    throw new Error("AUTH_SECRET must be set to at least 32 random characters");
  }
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export async function createSession(userId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: expiresAt })).toString("base64url");
  return {
    token: `${payload}.${sign(payload)}`,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
}

export function createWebSocketToken(userId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: expiresAt })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function getSessionUserId(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  const cookieToken = request.headers.get("cookie")?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith("conflux_session="))?.slice("conflux_session=".length);
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : cookieToken;
  if (!token) return null;
  const separator = token.indexOf(".");
  if (separator < 1 || separator === token.length - 1) return null;

  const payload = token.slice(0, separator);
  const suppliedSignature = token.slice(separator + 1);

  try {
    const expectedSignature = sign(payload);
    const expected = Buffer.from(expectedSignature);
    const supplied = Buffer.from(suppliedSignature);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

    const claims: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      typeof claims !== "object" ||
      claims === null ||
      !("sub" in claims) ||
      typeof claims.sub !== "string" ||
      !("exp" in claims) ||
      typeof claims.exp !== "number" ||
      !Number.isInteger(claims.exp) ||
      claims.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return claims.sub;
  } catch {
    return null;
  }
}

export async function getAuthenticatedUser(request: Request): Promise<PublicUser | null> {
  const userId = getSessionUserId(request);
  if (!userId) return null;

  const db = await getDb();
  const user = await db.orm.public.User.where({ id: userId }).first() as unknown as StoredUser | null;
  if (!user) return null;
  return toPublicUser(user);
}

export function toPublicUser(user: {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar_url: user.avatar_url,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function verifyUnknownAccountPassword(password: string) {
  return bcrypt.compare(password, await dummyPasswordHash);
}
