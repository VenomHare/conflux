import * as Y from "yjs";
import { apiError } from "@/lib/api";
import { getAuthenticatedUser } from "@/lib/auth";
import { uuidSchema } from "@/lib/schemas/workspace";
import { getWorkspaceMembership } from "@/lib/workspaces";
import { getDb } from "@repo/database";

export async function getPageHistoryAccess(request: Request, pageId: string, write = false) {
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
  if (write && membership.role !== "OWNER" && membership.role !== "ADMIN" && membership.role !== "EDITOR") {
    return { error: apiError("forbidden", "You cannot change this page's version history", 403) } as const;
  }
  return { db, page, membership, user } as const;
}

export function combinePageUpdates(updates: readonly { update: unknown }[]) {
  const document = new Y.Doc();
  for (const record of updates) {
    if (!(record.update instanceof Uint8Array)) throw new Error("Stored page update is not binary");
    Y.applyUpdate(document, record.update);
  }
  return Y.encodeStateAsUpdate(document);
}

export function isBinaryState(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array;
}

export function snapshotMetadata(snapshot: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(snapshot).filter(([key]) => key !== "document_state"));
}
