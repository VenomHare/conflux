import bcrypt from "bcrypt";
import { db, getDb } from "@repo/database";

const workspaceName = "Conflux Demo Workspace";
const demoUsers = [
  {
    name: "Conflux Demo Owner",
    email: "owner@conflux.local",
    role: "OWNER" as const,
  },
  {
    name: "Conflux Demo Editor",
    email: "editor@conflux.local",
    role: "EDITOR" as const,
  },
];

async function seed() {
  const password = process.env.SEED_DEMO_PASSWORD || "conflux-demo";
  if (password.length < 12) {
    throw new Error(
      "SEED_DEMO_PASSWORD must be at least 12 characters",
    );
  }
  await getDb();
  const passwordHash = await bcrypt.hash(password, 12);
  const users = await Promise.all(
    demoUsers.map((user) =>
      db.orm.public.User.upsert({
        create: {
          name: user.name,
          email: user.email,
          password_hash: passwordHash,
          avatar_url: null,
        },
        update: { name: user.name },
        conflictOn: { email: user.email },
      }),
    ),
  );
  const owner = users[0];
  if (!owner) throw new Error("Could not create the demo owner");

  const existingWorkspaces = await db.orm.public.Workspace.where({
    owner_id: owner.id,
  }).all();
  let workspace = existingWorkspaces.find(
    (candidate) => candidate.name === workspaceName,
  );
  if (!workspace) {
    workspace = await db.orm.public.Workspace.create({
      name: workspaceName,
      description: "Sample workspace for exploring Conflux.",
      owner_id: owner.id,
    });
  }

  for (const [index, user] of users.entries()) {
    const seededUser = demoUsers[index];
    if (!seededUser) continue;
    await db.orm.public.WorkspaceMember.upsert({
      create: {
        workspace_id: workspace.id,
        user_id: user.id,
        role: seededUser.role,
      },
      update: { role: seededUser.role },
      conflictOn: { workspace_id: workspace.id, user_id: user.id },
    });
  }

  const pages = await db.orm.public.Page.where({
    workspace_id: workspace.id,
  }).all();
  if (!pages.some((page) => page.title === "Welcome to Conflux")) {
    await db.orm.public.Page.create({
      workspace_id: workspace.id,
      title: "Welcome to Conflux",
      created_by: owner.id,
    });
  }

  console.log(`Seeded ${workspaceName}.`);
  console.log(`Demo users: ${demoUsers.map((user) => user.email).join(", ")}`);
  console.log(
    "New demo accounts use the password supplied in SEED_DEMO_PASSWORD.",
  );
}

async function main() {
  try {
    await seed();
  } catch (error) {
    console.error("Database seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
}

void main().catch((error) => {
  console.error("Database seeding failed:", error);
  process.exitCode = 1;
});
