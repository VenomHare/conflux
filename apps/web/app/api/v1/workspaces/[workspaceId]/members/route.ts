import { getDb } from "@repo/database";
import { apiError, apiResponse } from "@/lib/api";
import { getAuthenticatedUser } from "@/lib/auth";
import { uuidSchema } from "@/lib/schemas/workspace";
import { getWorkspaceMembership } from "@/lib/workspaces";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await context.params;
  const user = await getAuthenticatedUser(request).catch(() => null);
  if (!user) return apiError("unauthorized", "Sign in to continue", 401);
  if (!uuidSchema.safeParse(workspaceId).success) {
    return apiError("validation_error", "Workspace id must be a UUID", 400);
  }

  try {
    const membership = await getWorkspaceMembership(workspaceId, user.id);
    if (!membership) return apiError("not_found", "Workspace not found", 404);

    const db = await getDb();
    const memberships = await db.orm.public.WorkspaceMember.where({ workspace_id: workspaceId }).all();
    const members = await Promise.all(memberships.map(async ({ id, user_id, role, joined_at }) => {
      const member = await db.orm.public.User.where({ id: user_id }).first();
      if (!member) return null;
      return {
        id,
        role,
        joined_at,
        user: {
          id: member.id,
          name: member.name,
          email: member.email,
          avatar_url: member.avatar_url,
        },
      };
    }));
    return apiResponse({ members: members.filter((member) => member !== null) });
  } catch (error) {
    console.error("Workspace member list failed", error);
    return apiError("service_unavailable", "Workspace members are temporarily unavailable", 503);
  }
}
