import { apiError, apiResponse } from "@/lib/api";
import { getPageHistoryAccess, isBinaryState } from "@/lib/version-history";
import { uuidSchema } from "@/lib/schemas/workspace";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ pageId: string; snapshotId: string }> },
) {
  const { pageId, snapshotId } = await context.params;
  try {
    const access = await getPageHistoryAccess(request, pageId);
    if ("error" in access) return access.error;
    if (!uuidSchema.safeParse(snapshotId).success) return apiError("validation_error", "Snapshot id must be a UUID", 400);
    const snapshot = await access.db.orm.public.PageSnapshot.where({ id: snapshotId, page_id: pageId }).first();
    if (!snapshot) return apiError("not_found", "Snapshot not found", 404);
    if (!isBinaryState(snapshot.document_state)) {
      return apiError("service_unavailable", "Snapshot data is invalid", 503);
    }
    return apiResponse({ snapshot: { ...snapshot, document_state: Buffer.from(snapshot.document_state).toString("base64") } });
  } catch (error) {
    console.error("Snapshot lookup failed", error);
    return apiError("service_unavailable", "Snapshot is temporarily unavailable", 503);
  }
}
