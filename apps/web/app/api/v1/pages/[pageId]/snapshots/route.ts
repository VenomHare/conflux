import { apiError, apiResponse, readJson } from "@/lib/api";
import { getPageHistoryAccess, combinePageUpdates, snapshotMetadata } from "@/lib/version-history";
import { createSnapshotSchema } from "@/lib/schemas/snapshot";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ pageId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { pageId } = await context.params;
  let access: Awaited<ReturnType<typeof getPageHistoryAccess>>;
  try {
    access = await getPageHistoryAccess(request, pageId, true);
  } catch (error) {
    console.error("Snapshot access check failed", error);
    return apiError("service_unavailable", "Version history is temporarily unavailable", 503);
  }
  if ("error" in access) return access.error;

  const input = await readJson(request);
  if (input === null) return apiError("invalid_request", "Send a valid JSON request under 16 KB", 400);
  const parsed = createSnapshotSchema.safeParse(input);
  if (!parsed.success) return apiError("validation_error", parsed.error.issues[0]?.message ?? "Invalid snapshot", 400);
  try {
    const updates = await access.db.orm.public.PageUpdate.where({ page_id: pageId }).all();
    const state = combinePageUpdates(updates);
    const snapshot = await access.db.orm.public.PageSnapshot.create({
      page_id: pageId,
      created_by: access.user.id,
      document_state: state,
      label: parsed.data.label ?? null,
    });
    return apiResponse({ snapshot: snapshotMetadata(snapshot) }, 201);
  } catch (error) {
    console.error("Snapshot creation failed", error);
    return apiError("service_unavailable", "Snapshot creation is temporarily unavailable", 503);
  }
}

export async function GET(request: Request, context: RouteContext) {
  const { pageId } = await context.params;
  try {
    const access = await getPageHistoryAccess(request, pageId);
    if ("error" in access) return access.error;
    const snapshots = await access.db.orm.public.PageSnapshot.where({ page_id: pageId }).all();
    return apiResponse({ snapshots: snapshots.map((snapshot) => snapshotMetadata(snapshot)) });
  } catch (error) {
    console.error("Snapshot list failed", error);
    return apiError("service_unavailable", "Version history is temporarily unavailable", 503);
  }
}
