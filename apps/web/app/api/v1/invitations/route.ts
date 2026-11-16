import { getDb } from "@repo/database";
import { apiError, apiResponse } from "@/lib/api";
import { getAuthenticatedUser } from "@/lib/auth";
import { invitationIsUsable } from "@/lib/invitations";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request).catch(() => null);
  if (!user) return apiError("unauthorized", "Sign in to continue", 401);

  try {
    const db = await getDb();
    const matches = await db.orm.public.Invitation.where({ email: user.email }).all();
    const invitations = await Promise.all(
      matches.filter(invitationIsUsable).map(async ({ id, token, role, expires_at, workspace_id }) => {
        const workspace = await db.orm.public.Workspace.where({ id: workspace_id }).first();
        return workspace
          ? { id, token, role, expires_at, workspace: { id: workspace.id, name: workspace.name } }
          : null;
      }),
    );
    return apiResponse({ invitations: invitations.filter((invitation) => invitation !== null) });
  } catch (error) {
    console.error("Pending invitation list failed", error);
    return apiError("service_unavailable", "Invitations are temporarily unavailable", 503);
  }
}
