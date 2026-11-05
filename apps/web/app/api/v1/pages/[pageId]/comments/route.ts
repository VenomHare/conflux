import { apiError, apiResponse, readJson } from "@/lib/api";
import { canComment, getAccessiblePage } from "@/lib/comment-access";
import { createCommentSchema } from "@/lib/schemas/comment";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ pageId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { pageId } = await context.params;
  let access: Awaited<ReturnType<typeof getAccessiblePage>>;
  try {
    access = await getAccessiblePage(request, pageId);
  } catch (error) {
    console.error("Comment page access check failed", error);
    return apiError("service_unavailable", "Comments are temporarily unavailable", 503);
  }
  if ("error" in access) return access.error;
  if (!canComment(access.membership.role)) return apiError("forbidden", "You cannot comment on this page", 403);

  const input = await readJson(request);
  if (input === null) return apiError("invalid_request", "Send a valid JSON request under 16 KB", 400);
  const parsed = createCommentSchema.safeParse(input);
  if (!parsed.success) return apiError("validation_error", parsed.error.issues[0]?.message ?? "Invalid comment", 400);

  try {
    if (parsed.data.parent_id) {
      const parent = await access.db.orm.public.Comment.where({ id: parsed.data.parent_id, page_id: pageId }).first();
      if (!parent) return apiError("validation_error", "Parent comment must belong to this page", 400);
    }
    const comment = await access.db.orm.public.Comment.create({
      page_id: pageId,
      author_id: access.user.id,
      parent_id: parsed.data.parent_id ?? null,
      content: parsed.data.content,
      anchor: parsed.data.anchor,
    });
    return apiResponse({ comment }, 201);
  } catch (error) {
    console.error("Comment creation failed", error);
    return apiError("service_unavailable", "Comment creation is temporarily unavailable", 503);
  }
}

export async function GET(request: Request, context: RouteContext) {
  const { pageId } = await context.params;
  let access: Awaited<ReturnType<typeof getAccessiblePage>>;
  try {
    access = await getAccessiblePage(request, pageId);
  } catch (error) {
    console.error("Comment page access check failed", error);
    return apiError("service_unavailable", "Comments are temporarily unavailable", 503);
  }
  if ("error" in access) return access.error;
  try {
    const comments = await access.db.orm.public.Comment.where({ page_id: pageId }).all();
    return apiResponse({ comments });
  } catch (error) {
    console.error("Comment list failed", error);
    return apiError("service_unavailable", "Comments are temporarily unavailable", 503);
  }
}
