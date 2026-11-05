import { getDb } from "@repo/database";
import { apiError } from "@/lib/api";
import { getAuthenticatedUser } from "@/lib/auth";
import { uuidSchema } from "@/lib/schemas/workspace";
import { getWorkspaceMembership } from "@/lib/workspaces";

export async function getAccessiblePage(request: Request, pageId: string) {
  const user = await getAuthenticatedUser(request).catch(() => null);
  if (!user) return { error: apiError("unauthorized", "Sign in to continue", 401) } as const;
  if (!uuidSchema.safeParse(pageId).success) return { error: apiError("validation_error", "Page id must be a UUID", 400) } as const;
  const db = await getDb();
  const page = await db.orm.public.Page.where({ id: pageId, deleted_at: null }).first();
  if (!page || typeof page.workspace_id !== "string") {
    return { error: apiError("not_found", "Page not found", 404) } as const;
  }
  const membership = await getWorkspaceMembership(page.workspace_id, user.id).catch(() => null);
  if (!membership) return { error: apiError("not_found", "Page not found", 404) } as const;
  return { db, page, membership, user } as const;
}

export async function getAccessibleComment(request: Request, commentId: string) {
  const user = await getAuthenticatedUser(request).catch(() => null);
  if (!user) return { error: apiError("unauthorized", "Sign in to continue", 401) } as const;
  if (!uuidSchema.safeParse(commentId).success) return { error: apiError("validation_error", "Comment id must be a UUID", 400) } as const;
  const db = await getDb();
  const comment = await db.orm.public.Comment.where({ id: commentId }).first();
  if (!comment || typeof comment.page_id !== "string") {
    return { error: apiError("not_found", "Comment not found", 404) } as const;
  }
  const page = await db.orm.public.Page.where({ id: comment.page_id, deleted_at: null }).first();
  if (!page || typeof page.workspace_id !== "string") {
    return { error: apiError("not_found", "Comment not found", 404) } as const;
  }
  const membership = await getWorkspaceMembership(page.workspace_id, user.id).catch(() => null);
  if (!membership) return { error: apiError("not_found", "Comment not found", 404) } as const;
  return { db, comment, membership, user } as const;
}

export const canComment = (role: unknown) =>
  role === "OWNER" || role === "ADMIN" || role === "EDITOR" || role === "COMMENTER";

export const canManageAllComments = (role: unknown) => role === "OWNER" || role === "ADMIN";
