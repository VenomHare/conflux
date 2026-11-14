import * as Y from "yjs";
import { apiError, apiResponse } from "@/lib/api";
import { getPageHistoryAccess, isBinaryState } from "@/lib/version-history";
import { clearPageDocumentCache } from "@/lib/redis";
import { uuidSchema } from "@/lib/schemas/workspace";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ pageId: string; snapshotId: string }> },
) {
  const { pageId, snapshotId } = await context.params;
  console.log(
    `[restore] request page=${pageId} snapshot=${snapshotId} method=${request.method}`,
  );
  try {
    const access = await getPageHistoryAccess(request, pageId, true);
    if ("error" in access) {
      console.log(
        `[restore] access denied page=${pageId} snapshot=${snapshotId}`,
      );
      return access.error;
    }
    if (!uuidSchema.safeParse(snapshotId).success) {
      console.log(
        `[restore] invalid snapshot id page=${pageId} snapshot=${snapshotId}`,
      );
      return apiError("validation_error", "Snapshot id must be a UUID", 400);
    }

    const result = await access.db.transaction(async (tx) => {
      const snapshot = await tx.orm.public.PageSnapshot.where({
        id: snapshotId,
        page_id: pageId,
      }).first();
      if (!snapshot) {
        console.log(
          `[restore] snapshot not found page=${pageId} snapshot=${snapshotId}`,
        );
        return { error: "not_found" as const };
      }
      if (!isBinaryState(snapshot.document_state)) {
        console.log(
          `[restore] invalid snapshot state page=${pageId} snapshot=${snapshotId} type=${typeof snapshot.document_state}`,
        );
        return { error: "invalid_snapshot" as const };
      }
      console.log(
        `[restore] snapshot selected page=${pageId} snapshot=${snapshotId} created=${snapshot.created_at} bytes=${snapshot.document_state.byteLength}`,
      );

      // Lock the page before reading/replacing updates. The collaboration
      // writer takes this same lock, so no pre-restore update can land after
      // the restored state is installed.
      const previousPage = await tx.orm.public.Page.where({
        id: pageId,
        deleted_at: null,
      }).first();
      const previousTimestamp = previousPage
        ? Date.parse(previousPage.updated_at as string)
        : 0;
      const restoreTimestamp = new Date(
        Math.max(Date.now(), previousTimestamp + 1),
      ).toISOString();
      console.log(
        `[restore] page locked page=${pageId} previousUpdatedAt=${previousPage?.updated_at ?? "none"} restoreUpdatedAt=${restoreTimestamp}`,
      );
      await tx.orm.public.Page.where({ id: pageId, deleted_at: null }).update({
        updated_at: restoreTimestamp,
      });

      const target = new Y.Doc();
      let restoredUpdate: Uint8Array;
      try {
        Y.applyUpdate(target, snapshot.document_state as Uint8Array);
        restoredUpdate = Y.encodeStateAsUpdate(target);
      } finally {
        target.destroy();
      }
      const existingUpdates = (await tx.orm.public.PageUpdate.where({
        page_id: pageId,
      }).all()) as unknown as { id: string }[];
      console.log(
        `[restore] replacing database updates page=${pageId} snapshot=${snapshotId} oldCount=${existingUpdates.length}`,
      );
      for (const update of existingUpdates) {
        if (typeof update.id !== "string")
          throw new Error("Stored page update has no id");
        await tx.orm.public.PageUpdate.where({ id: update.id }).delete();
      }
      await tx.orm.public.PageUpdate.create({
        page_id: pageId,
        update: restoredUpdate,
      });
      console.log(
        `[restore] database update saved page=${pageId} snapshot=${snapshotId} bytes=${restoredUpdate.byteLength}`,
      );
      return { ok: true as const };
    });
    if ("error" in result) {
      if (result.error === "not_found")
        return apiError("not_found", "Snapshot not found", 404);
      return apiError("service_unavailable", "Snapshot data is invalid", 503);
    }
    const cacheCleared = await clearPageDocumentCache(pageId);
    console.log(
      `[restore] Redis cache ${cacheCleared ? "cleared" : "clear failed; cache will be rejected by updatedAt"} page=${pageId}`,
    );
    console.log(
      `[restore] complete page=${pageId} snapshot=${snapshotId} restored=${result.ok}`,
    );
    return apiResponse({ restored: result.ok });
  } catch (error) {
    console.error(
      `[restore] failed page=${pageId} snapshot=${snapshotId}: ${String(error)}`,
    );
    return apiError(
      "service_unavailable",
      "Snapshot restore is temporarily unavailable",
      503,
    );
  }
}
