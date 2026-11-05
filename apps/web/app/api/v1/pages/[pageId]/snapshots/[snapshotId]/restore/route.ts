import * as Y from "yjs";
import { apiError, apiResponse } from "@/lib/api";
import { getPageHistoryAccess, combinePageUpdates, isBinaryState } from "@/lib/version-history";
import { uuidSchema } from "@/lib/schemas/workspace";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ pageId: string; snapshotId: string }> },
) {
  const { pageId, snapshotId } = await context.params;
  try {
    const access = await getPageHistoryAccess(request, pageId, true);
    if ("error" in access) return access.error;
    if (!uuidSchema.safeParse(snapshotId).success) return apiError("validation_error", "Snapshot id must be a UUID", 400);

    const result = await access.db.transaction(async (tx) => {
      const snapshot = await tx.orm.public.PageSnapshot.where({ id: snapshotId, page_id: pageId }).first();
      if (!snapshot) return { error: "not_found" as const };
      if (!isBinaryState(snapshot.document_state)) return { error: "invalid_snapshot" as const };

      const target = new Y.Doc();
      Y.applyUpdate(target, snapshot.document_state);
      const updates = await tx.orm.public.PageUpdate.where({ page_id: pageId }).all();
      const currentState = combinePageUpdates(updates);
      await tx.orm.public.PageSnapshot.create({
        page_id: pageId,
        created_by: access.user.id,
        document_state: currentState,
        label: "Before restore",
      });
      const existingUpdates = await tx.orm.public.PageUpdate.where({ page_id: pageId }).all();
      for (const update of existingUpdates) {
        if (typeof update.id !== "string") throw new Error("Stored page update has no id");
        await tx.orm.public.PageUpdate.where({ id: update.id }).delete();
      }
      const restoredUpdate = Y.encodeStateAsUpdate(target);
      await tx.orm.public.PageUpdate.create({ page_id: pageId, update: restoredUpdate });
      return { ok: true as const };
    });
    if ("error" in result) {
      if (result.error === "not_found") return apiError("not_found", "Snapshot not found", 404);
      return apiError("service_unavailable", "Snapshot data is invalid", 503);
    }
    return apiResponse({ restored: result.ok });
  } catch (error) {
    console.error("Snapshot restore failed", error);
    return apiError("service_unavailable", "Snapshot restore is temporarily unavailable", 503);
  }
}
