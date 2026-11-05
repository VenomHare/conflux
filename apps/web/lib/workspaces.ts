import { getDb } from "@repo/database";

export async function getWorkspaceMembership(workspaceId: string, userId: string) {
  const db = await getDb();
  return db.orm.public.WorkspaceMember.where({ workspace_id: workspaceId, user_id: userId }).first();
}
