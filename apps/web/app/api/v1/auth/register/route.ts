import { getDb } from "@repo/database";
import { apiError, apiResponse, readJson } from "@/lib/api";
import { createSession, hashPassword, toPublicUser } from "@/lib/auth";
import { registerSchema } from "@/lib/auth-schemas";

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
    const existingUser = await db.orm.public.User.where({ email: parsed.data.email }).first();
    if (existingUser) {
      return apiError("email_unavailable", "An account with this email already exists", 409);
    }

    const user = await db.orm.public.User.create({
      name: parsed.data.name,
      email: parsed.data.email,
      password_hash: await hashPassword(parsed.data.password),
      avatar_url: null,
    });
    const session = await createSession(user.id);

    return apiResponse({ user: toPublicUser(user), ...session }, 201);
  } catch (error) {
    console.error("Registration failed", error);
    return apiError("service_unavailable", "Registration is temporarily unavailable", 503);
  }
}
