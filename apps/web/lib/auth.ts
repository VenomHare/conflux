import "server-only";

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getDb } from "@repo/database";

const SESSION_TTL_SECONDS = 60 * 60 * 24;
const BCRYPT_COST = 12;

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

export async function createSession(userId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  return {
    token: jwt.sign({}, secret(), {
      algorithm: "HS256",
      subject: userId,
      expiresIn: SESSION_TTL_SECONDS,
    }),
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
}

export function createWebSocketToken(userId: string) {
  return jwt.sign({}, secret(), {
    algorithm: "HS256",
    subject: userId,
    expiresIn: 60 * 60,
  });
}

function getSessionUserId(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  const cookieToken = request.headers.get("cookie")?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith("conflux_session="))?.slice("conflux_session=".length);
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : cookieToken;
  if (!token) return null;

  try {
    const claims = jwt.verify(token, secret(), { algorithms: ["HS256"] });
    if (
      typeof claims !== "object" ||
      claims === null ||
      typeof claims.sub !== "string" ||
      typeof claims.exp !== "number"
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

