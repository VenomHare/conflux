import { getDb } from "@repo/database";
import { apiError, apiResponse } from "@/lib/api";
import { getAuthenticatedUser } from "@/lib/auth";
import { invitationTokenSchema } from "@/lib/schemas/invitation";
import { invitationIsUsable } from "@/lib/invitations";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const user = await getAuthenticatedUser(request).catch(() => null);
  if (!user) return apiError("unauthorized", "Sign in to continue", 401);
  if (!invitationTokenSchema.safeParse(token).success) return apiError("not_found", "Invitation not found", 404);

  try {
    const db = await getDb();
    const invitation = await db.orm.public.Invitation.where({ token }).first();
    if (!invitation || invitation.email !== user.email || !invitationIsUsable(invitation)) {
      return apiError("not_found", "Invitation not found", 404);
    }
    const workspace = await db.orm.public.Workspace.where({ id: invitation.workspace_id }).first();
    if (!workspace) return apiError("not_found", "Invitation not found", 404);
    return apiResponse({ invitation: { id: invitation.id, email: invitation.email, role: invitation.role, expires_at: invitation.expires_at }, workspace: { id: workspace.id, name: workspace.name } });
  } catch (error) {
    console.error("Invitation lookup failed", error);
    return apiError("service_unavailable", "Invitation details are temporarily unavailable", 503);
  }
}
