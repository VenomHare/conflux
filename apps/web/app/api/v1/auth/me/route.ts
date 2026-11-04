import { apiError, apiResponse } from "@/lib/api";
import { getAuthenticatedUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError("unauthorized", "Sign in to continue", 401);
    return apiResponse({ user });
  } catch (error) {
    console.error("Authentication check failed", error);
    return apiError("service_unavailable", "Authentication is temporarily unavailable", 503);
  }
}
