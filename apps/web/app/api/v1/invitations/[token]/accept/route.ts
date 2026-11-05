import { getDb } from "@repo/database";
import { apiError, apiResponse } from "@/lib/api";
import { getAuthenticatedUser } from "@/lib/auth";
import { invitationTokenSchema } from "@/lib/schemas/invitation";
import { invitationIsUsable } from "@/lib/invitations";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const user = await getAuthenticatedUser(request).catch(() => null);
  if (!user) return apiError("unauthorized", "Sign in to continue", 401);
  if (!invitationTokenSchema.safeParse(token).success) return apiError("not_found", "Invitation not found", 404);

  try {
    const db = await getDb();
    const invitation = await db.orm.public.Invitation.where({ token }).first();
    if (!invitation || invitation.email !== user.email) return apiError("not_found", "Invitation not found", 404);
    if (invitation.accepted_at !== null) return apiError("conflict", "Invitation has already been accepted", 409);
    if (typeof invitation.expires_at !== "string" || new Date(invitation.expires_at).getTime() <= Date.now()) {
      return apiError("gone", "Invitation has expired", 410);
    }

    const existingMember = await db.orm.public.WorkspaceMember.where({ workspace_id: invitation.workspace_id, user_id: user.id }).first();
    if (existingMember) return apiError("conflict", "You are already a workspace member", 409);
    const member = await db.orm.public.WorkspaceMember.create({
      workspace_id: invitation.workspace_id,
      user_id: user.id,
      role: invitation.role,
    });
    try {
      const accepted = await db.orm.public.Invitation.where({ id: invitation.id, accepted_at: null }).update({ accepted_at: new Date().toISOString() });
      if (!accepted) {
        await db.orm.public.WorkspaceMember.where({ id: member.id }).delete();
        return apiError("conflict", "Invitation is no longer available", 409);
      }
    } catch (error) {
      await db.orm.public.WorkspaceMember.where({ id: member.id }).delete();
      throw error;
    }
    return apiResponse({ member }, 201);
  } catch (error) {
    console.error("Invitation acceptance failed", error);
    return apiError("service_unavailable", "Invitation acceptance is temporarily unavailable", 503);
  }
}
