import { apiError, apiResponse } from "@/lib/api";
import { canManageAllComments, getAccessibleComment } from "@/lib/comment-access";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ commentId: string }> }) {
  const { commentId } = await context.params;
  try {
    const access = await getAccessibleComment(request, commentId);
    if ("error" in access) return access.error;
    if (access.comment.author_id !== access.user.id && !canManageAllComments(access.membership.role)) {
      return apiError("forbidden", "Only the author or a workspace manager can reopen this comment", 403);
    }
    const comment = await access.db.orm.public.Comment.where({ id: commentId }).update({
      resolved_at: null,
      updated_at: new Date().toISOString(),
    });
    if (!comment) return apiError("not_found", "Comment not found", 404);
    return apiResponse({ comment });
  } catch (error) {
    console.error("Comment reopening failed", error);
    return apiError("service_unavailable", "Comment reopening is temporarily unavailable", 503);
  }
}
