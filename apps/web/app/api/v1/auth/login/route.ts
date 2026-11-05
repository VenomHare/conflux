import { getDb } from "@repo/database";
import { apiError, apiResponse, readJson } from "@/lib/api";
import {
  createSession,
  toPublicUser,
  verifyPassword,
  verifyUnknownAccountPassword,
} from "@/lib/auth";
import { loginSchema } from "@/lib/schemas/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const input = await readJson(request);
  if (input === null) return apiError("invalid_request", "Send a valid JSON request under 16 KB", 400);

  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return apiError("validation_error", parsed.error.issues[0]?.message ?? "Invalid request", 400);
  }

  try {
    const db = await getDb();
    const user = await db.orm.public.User.where({ email: parsed.data.email }).first();
    const validPassword = user
      ? await verifyPassword(parsed.data.password, user.password_hash)
      : (await verifyUnknownAccountPassword(parsed.data.password), false);

    if (!user || !validPassword) {
      return apiError("invalid_credentials", "Email or password is incorrect", 401);
    }

    const session = await createSession(user.id);
    return apiResponse({ user: toPublicUser(user), ...session });
  } catch (error) {
    console.error("Login failed", error);
    return apiError("service_unavailable", "Login is temporarily unavailable", 503);
  }
}
