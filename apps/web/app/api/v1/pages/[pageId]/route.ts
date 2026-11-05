import { getDb } from "@repo/database";
import { apiError, apiResponse, readJson } from "@/lib/api";
import { getAuthenticatedUser } from "@/lib/auth";
import { updatePageSchema } from "@/lib/schemas/page";
import { uuidSchema } from "@/lib/schemas/workspace";
import { getWorkspaceMembership } from "@/lib/workspaces";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ pageId: string }> };
const canEditPages = (role: unknown) => role === "OWNER" || role === "ADMIN" || role === "EDITOR";

async function getAccessiblePage(request: Request, pageId: string) {
  const user = await getAuthenticatedUser(request).catch(() => null);
  if (!user) return { error: apiError("unauthorized", "Sign in to continue", 401) } as const;
  if (!uuidSchema.safeParse(pageId).success) return { error: apiError("validation_error", "Page id must be a UUID", 400) } as const;
  const db = await getDb();
  const page = await db.orm.public.Page.where({ id: pageId, deleted_at: null }).first();
  if (!page) return { error: apiError("not_found", "Page not found", 404) } as const;
  if (typeof page.workspace_id !== "string") return { error: apiError("not_found", "Page not found", 404) } as const;
  const membership = await getWorkspaceMembership(page.workspace_id, user.id).catch(() => null);
  if (!membership) return { error: apiError("not_found", "Page not found", 404) } as const;
  return { db, page, membership } as const;
}

export async function GET(request: Request, context: RouteContext) {
  const { pageId } = await context.params;
  try {
    const access = await getAccessiblePage(request, pageId);
    if ("error" in access) return access.error;
    return apiResponse({ page: access.page });
  } catch (error) {
    console.error("Page lookup failed", error);
    return apiError("service_unavailable", "Page is temporarily unavailable", 503);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { pageId } = await context.params;
  let access: Awaited<ReturnType<typeof getAccessiblePage>>;
  try {
    access = await getAccessiblePage(request, pageId);
  } catch (error) {
    console.error("Page access check failed", error);
    return apiError("service_unavailable", "Page is temporarily unavailable", 503);
  }
  if ("error" in access) return access.error;
  if (!canEditPages(access.membership.role)) {
    return apiError("forbidden", "You cannot update this page", 403);
  }

  const input = await readJson(request);
  if (input === null) return apiError("invalid_request", "Send a valid JSON request under 16 KB", 400);
  const parsed = updatePageSchema.safeParse(input);
  if (!parsed.success) return apiError("validation_error", parsed.error.issues[0]?.message ?? "Invalid page", 400);
  try {
    const page = await access.db.orm.public.Page.where({ id: pageId, deleted_at: null }).update({
      title: parsed.data.title,
      updated_at: new Date().toISOString(),
    });
    if (!page) return apiError("not_found", "Page not found", 404);
    return apiResponse({ page });
  } catch (error) {
    console.error("Page update failed", error);
    return apiError("service_unavailable", "Page update is temporarily unavailable", 503);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { pageId } = await context.params;
  let access: Awaited<ReturnType<typeof getAccessiblePage>>;
  try {
    access = await getAccessiblePage(request, pageId);
  } catch (error) {
    console.error("Page access check failed", error);
    return apiError("service_unavailable", "Page is temporarily unavailable", 503);
  }
  if ("error" in access) return access.error;
  if (!canEditPages(access.membership.role)) {
    return apiError("forbidden", "You cannot delete this page", 403);
  }

  try {
    const now = new Date().toISOString();
    const page = await access.db.orm.public.Page.where({ id: pageId, deleted_at: null }).update({ deleted_at: now, updated_at: now });
    if (!page) return apiError("not_found", "Page not found", 404);
    return apiResponse({ deleted: true });
  } catch (error) {
    console.error("Page deletion failed", error);
    return apiError("service_unavailable", "Page deletion is temporarily unavailable", 503);
  }
}
