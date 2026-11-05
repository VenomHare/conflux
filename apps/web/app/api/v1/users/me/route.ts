import { getDb } from "@repo/database";
import { apiError, apiResponse, readJson } from "@/lib/api";
import { getAuthenticatedUser, toPublicUser } from "@/lib/auth";
import { updateProfileSchema } from "@/lib/schemas/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError("unauthorized", "Sign in to continue", 401);
    return apiResponse({ user });
  } catch (error) {
    console.error("Profile lookup failed", error);
    return apiError("service_unavailable", "Profile is temporarily unavailable", 503);
  }
}

export async function PATCH(request: Request) {
  const currentUser = await getAuthenticatedUser(request).catch(() => null);
  if (!currentUser) return apiError("unauthorized", "Sign in to continue", 401);

  const input = await readJson(request);
  if (input === null) return apiError("invalid_request", "Send a valid JSON request under 16 KB", 400);

  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return apiError("validation_error", parsed.error.issues[0]?.message ?? "Invalid request", 400);
  }

  try {
    const db = await getDb();
    const updated = await db.orm.public.User.where({ id: currentUser.id }).update({
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.avatar_url !== undefined ? { avatar_url: parsed.data.avatar_url } : {}),
      updated_at: new Date().toISOString(),
    });

    if (!updated) return apiError("not_found", "User account no longer exists", 404);
    return apiResponse({ user: toPublicUser(updated) });
  } catch (error) {
    console.error("Profile update failed", error);
    return apiError("service_unavailable", "Profile update is temporarily unavailable", 503);
  }
}
