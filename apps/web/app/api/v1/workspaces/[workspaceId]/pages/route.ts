import { getDb } from "@repo/database";
import { apiError, apiResponse, readJson } from "@/lib/api";
import { getAuthenticatedUser } from "@/lib/auth";
import { createPageSchema } from "@/lib/schemas/page";
import { uuidSchema } from "@/lib/schemas/workspace";
import { getWorkspaceMembership } from "@/lib/workspaces";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ workspaceId: string }> };
const canEditPages = (role: unknown) => role === "OWNER" || role === "ADMIN" || role === "EDITOR";

export async function POST(request: Request, context: RouteContext) {
  const { workspaceId } = await context.params;
  const user = await getAuthenticatedUser(request).catch(() => null);
  if (!user) return apiError("unauthorized", "Sign in to continue", 401);
  if (!uuidSchema.safeParse(workspaceId).success) return apiError("validation_error", "Workspace id must be a UUID", 400);

  const membership = await getWorkspaceMembership(workspaceId, user.id).catch(() => null);
  if (!membership) return apiError("not_found", "Workspace not found", 404);
  if (!canEditPages(membership.role)) {
    return apiError("forbidden", "You cannot create pages in this workspace", 403);
  }

  const input = await readJson(request);
  if (input === null) return apiError("invalid_request", "Send a valid JSON request under 16 KB", 400);
  const parsed = createPageSchema.safeParse(input);
  if (!parsed.success) return apiError("validation_error", parsed.error.issues[0]?.message ?? "Invalid page", 400);

  try {
    const db = await getDb();
    const page = await db.orm.public.Page.create({
      workspace_id: workspaceId,
      title: parsed.data.title,
      created_by: user.id,
    });
    return apiResponse({ page }, 201);
  } catch (error) {
    console.error("Page creation failed", error);
    return apiError("service_unavailable", "Page creation is temporarily unavailable", 503);
  }
}

export async function GET(request: Request, context: RouteContext) {
  const { workspaceId } = await context.params;
  const user = await getAuthenticatedUser(request).catch(() => null);
  if (!user) return apiError("unauthorized", "Sign in to continue", 401);
  if (!uuidSchema.safeParse(workspaceId).success) return apiError("validation_error", "Workspace id must be a UUID", 400);
  const membership = await getWorkspaceMembership(workspaceId, user.id).catch(() => null);
  if (!membership) return apiError("not_found", "Workspace not found", 404);

  try {
    const db = await getDb();
    const pages = await db.orm.public.Page.where({ workspace_id: workspaceId, deleted_at: null }).all();
    return apiResponse({ pages });
  } catch (error) {
    console.error("Page list failed", error);
    return apiError("service_unavailable", "Pages are temporarily unavailable", 503);
  }
}
