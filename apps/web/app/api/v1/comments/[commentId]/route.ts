import { apiError, apiResponse, readJson } from "@/lib/api";
import { canManageAllComments, getAccessibleComment } from "@/lib/comment-access";
import { updateCommentSchema } from "@/lib/schemas/comment";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ commentId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { commentId } = await context.params;
  try {
    const access = await getAccessibleComment(request, commentId);
    if ("error" in access) return access.error;
    return apiResponse({ comment: access.comment });
  } catch (error) {
    console.error("Comment lookup failed", error);
    return apiError("service_unavailable", "Comment is temporarily unavailable", 503);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { commentId } = await context.params;
  let access: Awaited<ReturnType<typeof getAccessibleComment>>;
  try {
    access = await getAccessibleComment(request, commentId);
  } catch (error) {
    console.error("Comment access check failed", error);
    return apiError("service_unavailable", "Comment is temporarily unavailable", 503);
  }
  if ("error" in access) return access.error;
  if (access.comment.author_id !== access.user.id && !canManageAllComments(access.membership.role)) {
    return apiError("forbidden", "You can only edit your own comments", 403);
  }
  const input = await readJson(request);
  if (input === null) return apiError("invalid_request", "Send a valid JSON request under 16 KB", 400);
  const parsed = updateCommentSchema.safeParse(input);
  if (!parsed.success) return apiError("validation_error", parsed.error.issues[0]?.message ?? "Invalid comment", 400);
  try {
    const comment = await access.db.orm.public.Comment.where({ id: commentId }).update({
      ...(parsed.data.content !== undefined ? { content: parsed.data.content } : {}),
      ...(parsed.data.anchor !== undefined ? { anchor: parsed.data.anchor } : {}),
      updated_at: new Date().toISOString(),
    });
    if (!comment) return apiError("not_found", "Comment not found", 404);
    return apiResponse({ comment });
  } catch (error) {
    console.error("Comment update failed", error);
    return apiError("service_unavailable", "Comment update is temporarily unavailable", 503);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { commentId } = await context.params;
  try {
    const access = await getAccessibleComment(request, commentId);
    if ("error" in access) return access.error;
    if (access.comment.author_id !== access.user.id && !canManageAllComments(access.membership.role)) {
      return apiError("forbidden", "You can only delete your own comments", 403);
    }
    const deleted = await access.db.orm.public.Comment.where({ id: commentId }).delete();
    if (!deleted) return apiError("not_found", "Comment not found", 404);
    return apiResponse({ deleted: true });
  } catch (error) {
    console.error("Comment deletion failed", error);
    return apiError("service_unavailable", "Comment deletion is temporarily unavailable", 503);
  }
}
