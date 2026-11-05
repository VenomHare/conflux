import { getDb } from "@repo/database";
import { apiError, apiResponse, readJson } from "@/lib/api";
import { getAuthenticatedUser } from "@/lib/auth";
import { uuidSchema } from "@/lib/schemas/workspace";
import { getWorkspaceMembership } from "@/lib/workspaces";
import { z } from "zod";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ workspaceId: string; userId: string }> };
const memberRoleSchema = z.enum(["ADMIN", "EDITOR", "COMMENTER", "VIEWER"]);

async function getManager(request: Request, workspaceId: string) {
  const user = await getAuthenticatedUser(request).catch(() => null);
  if (!user) return { error: apiError("unauthorized", "Sign in to continue", 401) } as const;
  if (!uuidSchema.safeParse(workspaceId).success) {
    return { error: apiError("validation_error", "Workspace id must be a UUID", 400) } as const;
  }
  const membership = await getWorkspaceMembership(workspaceId, user.id).catch(() => null);
  if (!membership) return { error: apiError("not_found", "Workspace not found", 404) } as const;
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    return { error: apiError("forbidden", "Only workspace owners and admins can manage members", 403) } as const;
  }
  return { user, membership } as const;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { workspaceId, userId } = await context.params;
  const manager = await getManager(request, workspaceId);
  if ("error" in manager) return manager.error;
  if (!uuidSchema.safeParse(userId).success) return apiError("validation_error", "User id must be a UUID", 400);

  const input = await readJson(request);
  if (input === null) return apiError("invalid_request", "Send a valid JSON request under 16 KB", 400);
  const parsed = z.object({ role: memberRoleSchema }).strict().safeParse(input);
  if (!parsed.success) return apiError("validation_error", parsed.error.issues[0]?.message ?? "Invalid member role", 400);

  try {
    const db = await getDb();
    const target = await db.orm.public.WorkspaceMember.where({ workspace_id: workspaceId, user_id: userId }).first();
    if (!target) return apiError("not_found", "Workspace member not found", 404);
    if (target.role === "OWNER") return apiError("forbidden", "The workspace owner role cannot be changed", 403);
    if (manager.membership.role === "ADMIN" && target.role === "ADMIN") {
      return apiError("forbidden", "Admins cannot change another admin's role", 403);
    }
    const updated = await db.orm.public.WorkspaceMember.where({ id: target.id }).update({ role: parsed.data.role });
    if (!updated) return apiError("not_found", "Workspace member not found", 404);
    return apiResponse({ member: updated });
  } catch (error) {
    console.error("Workspace member role update failed", error);
    return apiError("service_unavailable", "Workspace member update is temporarily unavailable", 503);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { workspaceId, userId } = await context.params;
  const manager = await getManager(request, workspaceId);
  if ("error" in manager) return manager.error;
  if (!uuidSchema.safeParse(userId).success) return apiError("validation_error", "User id must be a UUID", 400);

  try {
    const db = await getDb();
    const target = await db.orm.public.WorkspaceMember.where({ workspace_id: workspaceId, user_id: userId }).first();
    if (!target) return apiError("not_found", "Workspace member not found", 404);
    if (target.role === "OWNER") return apiError("forbidden", "The workspace owner cannot be removed", 403);
    if (manager.membership.role === "ADMIN" && target.role === "ADMIN") {
      return apiError("forbidden", "Admins cannot remove another admin", 403);
    }
    const deleted = await db.orm.public.WorkspaceMember.where({ id: target.id }).delete();
    if (!deleted) return apiError("not_found", "Workspace member not found", 404);
    return apiResponse({ removed: true });
  } catch (error) {
    console.error("Workspace member removal failed", error);
    return apiError("service_unavailable", "Workspace member removal is temporarily unavailable", 503);
  }
}
