import * as Y from "yjs";
import { apiError, apiResponse } from "@/lib/api";
import {
  getPageHistoryAccess,
  combinePageUpdates,
  snapshotMetadata,
} from "@/lib/version-history";
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
    return apiError(
      "service_unavailable",
      "Version history is temporarily unavailable",
      503,
    );
  }
  if ("error" in access) return access.error;

  const input = await request.json().catch(() => null);
  if (input === null)
    return apiError(
      "invalid_request",
      "Send a valid JSON request",
      400,
    );
  const parsed = createSnapshotSchema.safeParse(input);
  if (!parsed.success)
    return apiError(
      "validation_error",
      parsed.error.issues[0]?.message ?? "Invalid snapshot",
      400,
    );
  try {
    let state: Uint8Array;
    if (parsed.data.document_state) {
      const document = new Y.Doc();
      try {
        const encodedState = Buffer.from(parsed.data.document_state, "base64");
        Y.applyUpdate(document, encodedState);
        state = Y.encodeStateAsUpdate(document);
      } finally {
        document.destroy();
      }
    } else {
      const updates = await access.db.orm.public.PageUpdate.where({
        page_id: pageId,
      }).all();
      state = combinePageUpdates(updates as unknown as { update: unknown }[]);
    }
    const snapshot = await access.db.orm.public.PageSnapshot.create({
      page_id: pageId,
      created_by: access.user.id,
      document_state: state,
      label: parsed.data.label ?? null,
    });
    return apiResponse({ snapshot: snapshotMetadata(snapshot) }, 201);
  } catch (error) {
    console.error("Snapshot creation failed", error);
    return apiError(
      "service_unavailable",
      "Snapshot creation is temporarily unavailable",
      503,
    );
  }
}

export async function GET(request: Request, context: RouteContext) {
  const { pageId } = await context.params;
  try {
    const access = await getPageHistoryAccess(request, pageId);
    if ("error" in access) return access.error;
    const snapshots = await access.db.orm.public.PageSnapshot.where({
      page_id: pageId,
    }).all();
    const authors = await access.db.orm.public.User.all();
    const users = new Map(authors.map((author) => [author.id, author]));
    return apiResponse({
      snapshots: snapshots.map((snapshot) => {
        const author = users.get(snapshot.created_by);
        return {
          ...snapshotMetadata(snapshot),
          author: author
            ? {
                id: author.id,
                name: author.name,
                avatar_url: author.avatar_url,
              }
            : null,
        };
      }),
    });
  } catch (error) {
    console.error("Snapshot list failed", error);
    return apiError(
      "service_unavailable",
      "Version history is temporarily unavailable",
      503,
    );
  }
}
