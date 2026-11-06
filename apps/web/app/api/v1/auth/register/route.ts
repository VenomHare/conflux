import { getDb } from "@repo/database";
import { apiError, apiResponse, readJson } from "@/lib/api";
import { createSession, hashPassword, toPublicUser, type StoredUser } from "@/lib/auth";
import { registerSchema } from "@/lib/schemas/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const input = await readJson(request);
  if (input === null) return apiError("invalid_request", "Send a valid JSON request under 16 KB", 400);

  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return apiError("validation_error", parsed.error.issues[0]?.message ?? "Invalid request", 400);
  }

  try {
    const db = await getDb();
    const registration = parsed.data as { name: string; email: string; password: string };
    const existingUser = await db.orm.public.User.where({ email: registration.email }).first();
    if (existingUser) {
      return apiError("email_unavailable", "An account with this email already exists", 409);
    }

    const user = await db.orm.public.User.create({
      name: registration.name,
      email: registration.email,
      password_hash: await hashPassword(registration.password),
      avatar_url: null,
    }) as unknown as StoredUser;
    const session = await createSession(user.id);

    const response = apiResponse({ user: toPublicUser(user), ...session }, 201);
    response.cookies.set("conflux_session", session.token, {
      httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/",
      expires: new Date(session.expiresAt),
    });
    return response;
  } catch (error) {
    console.error("Registration failed", error);
    return apiError("service_unavailable", "Registration is temporarily unavailable", 503);
  }
}
