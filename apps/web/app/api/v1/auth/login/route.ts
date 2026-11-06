import { getDb } from "@repo/database";
import { apiError, apiResponse, readJson } from "@/lib/api";
import {
  createSession,
  toPublicUser,
  verifyPassword,
  verifyUnknownAccountPassword,
  type StoredUser,
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
    const credentials = parsed.data as { email: string; password: string };
    const user = await db.orm.public.User.where({ email: credentials.email }).first() as unknown as StoredUser | null;
    const validPassword = user
      ? await verifyPassword(credentials.password, user.password_hash)
      : (await verifyUnknownAccountPassword(credentials.password), false);

    if (!user || !validPassword) {
      return apiError("invalid_credentials", "Email or password is incorrect", 401);
    }

    const session = await createSession(user.id);
    const response = apiResponse({ user: toPublicUser(user), ...session });
    response.cookies.set("conflux_session", session.token, {
      httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/",
      expires: new Date(session.expiresAt),
    });
    return response;
  } catch (error) {
    console.error("Login failed", error);
    return apiError("service_unavailable", "Login is temporarily unavailable", 503);
  }
}
