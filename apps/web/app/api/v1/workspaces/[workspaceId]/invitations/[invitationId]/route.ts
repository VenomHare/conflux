import { getDb } from "@repo/database";
import { apiError, apiResponse } from "@/lib/api";
import { getAuthenticatedUser } from "@/lib/auth";
import { uuidSchema } from "@/lib/schemas/workspace";
import { getWorkspaceManager } from "@/lib/invitations";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ workspaceId: string; invitationId: string }> }) {
  const { workspaceId, invitationId } = await context.params;
  const user = await getAuthenticatedUser(request).catch(() => null);
  if (!user) return apiError("unauthorized", "Sign in to continue", 401);
  if (!uuidSchema.safeParse(workspaceId).success || !uuidSchema.safeParse(invitationId).success) {
    return apiError("validation_error", "Workspace and invitation ids must be UUIDs", 400);
  }
  const manager = await getWorkspaceManager(workspaceId, user.id).catch(() => null);
  if (!manager) return apiError("not_found", "Workspace not found", 404);
  if (manager.role !== "OWNER" && manager.role !== "ADMIN") {
    return apiError("forbidden", "Only workspace owners and admins can revoke invitations", 403);
  }

  try {
    const db = await getDb();
    const invitation = await db.orm.public.Invitation.where({ id: invitationId, workspace_id: workspaceId }).first();
    if (!invitation) return apiError("not_found", "Invitation not found", 404);
    if (invitation.accepted_at !== null) return apiError("conflict", "Accepted invitations cannot be revoked", 409);
    const revoked = await db.orm.public.Invitation.where({ id: invitationId, workspace_id: workspaceId }).delete();
    if (!revoked) return apiError("not_found", "Invitation not found", 404);
    return apiResponse({ revoked: true });
  } catch (error) {
    console.error("Invitation revocation failed", error);
    return apiError("service_unavailable", "Invitation revocation is temporarily unavailable", 503);
  }
}
