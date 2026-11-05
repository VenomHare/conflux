import { getDb } from "@repo/database";
import { apiError, apiResponse, readJson } from "@/lib/api";
import { getAuthenticatedUser } from "@/lib/auth";
import { updateWorkspaceSchema, uuidSchema } from "@/lib/schemas/workspace";
import { getWorkspaceMembership } from "@/lib/workspaces";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ workspaceId: string }> };

async function authenticatedMember(request: Request, workspaceId: string) {
  const user = await getAuthenticatedUser(request).catch(() => null);
  if (!user) return { error: apiError("unauthorized", "Sign in to continue", 401) } as const;
  if (!uuidSchema.safeParse(workspaceId).success) {
    return { error: apiError("validation_error", "Workspace id must be a UUID", 400) } as const;
  }
  const membership = await getWorkspaceMembership(workspaceId, user.id).catch(() => null);
  if (!membership) return { error: apiError("not_found", "Workspace not found", 404) } as const;
  return { user, membership } as const;
}

export async function GET(request: Request, context: RouteContext) {
  const { workspaceId } = await context.params;
  const access = await authenticatedMember(request, workspaceId);
  if ("error" in access) return access.error;
  try {
    const db = await getDb();
    const workspace = await db.orm.public.Workspace.where({ id: workspaceId }).first();
    if (!workspace) return apiError("not_found", "Workspace not found", 404);
    return apiResponse({ workspace });
  } catch (error) {
    console.error("Workspace lookup failed", error);
    return apiError("service_unavailable", "Workspace details are temporarily unavailable", 503);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { workspaceId } = await context.params;
  const access = await authenticatedMember(request, workspaceId);
  if ("error" in access) return access.error;
  if (access.membership.role !== "OWNER" && access.membership.role !== "ADMIN") {
    return apiError("forbidden", "You cannot update this workspace", 403);
  }
  const input = await readJson(request);
  if (input === null) return apiError("invalid_request", "Send a valid JSON request under 16 KB", 400);
  const parsed = updateWorkspaceSchema.safeParse(input);
  if (!parsed.success) return apiError("validation_error", parsed.error.issues[0]?.message ?? "Invalid request", 400);
  try {
    const db = await getDb();
    const workspace = await db.orm.public.Workspace.where({ id: workspaceId }).update({
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      updated_at: new Date().toISOString(),
    });
    if (!workspace) return apiError("not_found", "Workspace not found", 404);
    return apiResponse({ workspace });
  } catch (error) {
    console.error("Workspace update failed", error);
    return apiError("service_unavailable", "Workspace update is temporarily unavailable", 503);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { workspaceId } = await context.params;
  const access = await authenticatedMember(request, workspaceId);
  if ("error" in access) return access.error;
  if (access.membership.role !== "OWNER") return apiError("forbidden", "Only the owner can delete this workspace", 403);
  try {
    const db = await getDb();
    const deleted = await db.orm.public.Workspace.where({ id: workspaceId }).delete();
    if (!deleted) return apiError("not_found", "Workspace not found", 404);
    return apiResponse({ deleted: true });
  } catch (error) {
    console.error("Workspace deletion failed", error);
    return apiError("service_unavailable", "Workspace deletion is temporarily unavailable", 503);
  }
}
