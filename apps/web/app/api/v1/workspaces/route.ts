import { getDb } from "@repo/database";
import { apiError, apiResponse, readJson } from "@/lib/api";
import { getAuthenticatedUser } from "@/lib/auth";
import { createWorkspaceSchema } from "@/lib/schemas/workspace";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request).catch(() => null);
  if (!user) return apiError("unauthorized", "Sign in to continue", 401);

  const input = await readJson(request);
  if (input === null) return apiError("invalid_request", "Send a valid JSON request under 16 KB", 400);
  const parsed = createWorkspaceSchema.safeParse(input);
  if (!parsed.success) return apiError("validation_error", parsed.error.issues[0]?.message ?? "Invalid request", 400);

  try {
    const db = await getDb();
    const workspace = await db.orm.public.Workspace.create({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      owner_id: user.id,
    });
    try {
      await db.orm.public.WorkspaceMember.create({ workspace_id: workspace.id, user_id: user.id, role: "OWNER" });
    } catch (error) {
      await db.orm.public.Workspace.where({ id: workspace.id }).delete();
      throw error;
    }
    return apiResponse({ workspace }, 201);
  } catch (error) {
    console.error("Workspace creation failed", error);
    return apiError("service_unavailable", "Workspace creation is temporarily unavailable", 503);
  }
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request).catch(() => null);
  if (!user) return apiError("unauthorized", "Sign in to continue", 401);

  try {
    const db = await getDb();
    const memberships = await db.orm.public.WorkspaceMember.where({ user_id: user.id }).all();
    const workspaces = await Promise.all(memberships.map(async ({ workspace_id, role }) => {
      const workspace = await db.orm.public.Workspace.where({ id: workspace_id }).first();
      return workspace ? { ...workspace, myRole: role } : null;
    }));
    return apiResponse({ workspaces: workspaces.filter((workspace) => workspace !== null) });
  } catch (error) {
    console.error("Workspace list failed", error);
    return apiError("service_unavailable", "Workspace list is temporarily unavailable", 503);
  }
}
