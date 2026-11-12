import { apiError, apiResponse } from "@/lib/api";
import { createWebSocketToken, getAuthenticatedUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError("unauthorized", "Sign in to continue", 401);
    return apiResponse({ token: createWebSocketToken(user.id) });
  } catch (error) {
    console.error("WebSocket token creation failed", error);
    return apiError("service_unavailable", "Collaboration is temporarily unavailable", 503);
  }
}
