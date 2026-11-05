import { getDb } from "@repo/database";

export async function getWorkspaceManager(workspaceId: string, userId: string) {
  const db = await getDb();
  return db.orm.public.WorkspaceMember.where({ workspace_id: workspaceId, user_id: userId }).first();
}

export function invitationIsUsable(invitation: unknown) {
  if (typeof invitation !== "object" || invitation === null) return false;
  const record = invitation as Record<string, unknown>;
  return record.accepted_at === null && typeof record.expires_at === "string" &&
    new Date(record.expires_at).getTime() > Date.now();
}
