import { db } from "@repo/database";
import { apiError, apiResponse } from "@/lib/api";
import { getAuthenticatedUser, toPublicUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const viewer = await getAuthenticatedUser(request);
    if (!viewer) return apiError("unauthorized", "Sign in to continue", 401);

    const { userId } = await context.params;
    const user = await db.orm.public.User.where({ id: userId }).first();
    if (!user) return apiError("not_found", "User not found", 404);
    return apiResponse({ user: toPublicUser(user) });
  } catch (error) {
    console.error("User lookup failed", error);
    return apiError("service_unavailable", "User details are temporarily unavailable", 503);
  }
}
