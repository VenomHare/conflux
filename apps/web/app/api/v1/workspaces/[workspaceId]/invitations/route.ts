import { randomBytes } from "node:crypto";
import { getDb } from "@repo/database";
import { apiError, apiResponse, readJson } from "@/lib/api";
import { getAuthenticatedUser } from "@/lib/auth";
import { createInvitationSchema } from "@/lib/schemas/invitation";
import { uuidSchema } from "@/lib/schemas/workspace";
import { getWorkspaceManager } from "@/lib/invitations";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await context.params;
  const user = await getAuthenticatedUser(request).catch(() => null);
  if (!user) return apiError("unauthorized", "Sign in to continue", 401);
  if (!uuidSchema.safeParse(workspaceId).success) return apiError("validation_error", "Workspace id must be a UUID", 400);
  const manager = await getWorkspaceManager(workspaceId, user.id).catch(() => null);
  if (!manager) return apiError("not_found", "Workspace not found", 404);
  if (manager.role !== "OWNER" && manager.role !== "ADMIN") {
    return apiError("forbidden", "Only workspace owners and admins can invite members", 403);
  }

  const input = await readJson(request);
  if (input === null) return apiError("invalid_request", "Send a valid JSON request under 16 KB", 400);
  const parsed = createInvitationSchema.safeParse(input);
  if (!parsed.success) return apiError("validation_error", parsed.error.issues[0]?.message ?? "Invalid invitation", 400);
  if (manager.role === "ADMIN" && parsed.data.role === "ADMIN") {
    return apiError("forbidden", "Only the workspace owner can invite admins", 403);
  }

  try {
    const db = await getDb();
    const existingUser = await db.orm.public.User.where({ email: parsed.data.email }).first();
    if (existingUser) {
      const existingMember = await db.orm.public.WorkspaceMember.where({ workspace_id: workspaceId, user_id: existingUser.id }).first();
      if (existingMember) return apiError("conflict", "This user is already a workspace member", 409);
    }

    const invitation = await db.orm.public.Invitation.create({
      workspace_id: workspaceId,
      invited_by: user.id,
      email: parsed.data.email,
      token: randomBytes(32).toString("base64url"),
      role: parsed.data.role,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    return apiResponse({ invitation }, 201);
  } catch (error) {
    console.error("Invitation creation failed", error);
    return apiError("service_unavailable", "Invitation creation is temporarily unavailable", 503);
  }
}
