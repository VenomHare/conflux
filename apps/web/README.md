# Conflux web app

Follow the repository [setup instructions](../../README.md) to install Bun
dependencies, configure environment files, start PostgreSQL, apply the database
contract, and run the web app together with the collaboration WebSocket service.

From the repository root, use `bun dev` for development. The Next.js app runs
on port 3000 by default. It requires a reachable PostgreSQL database and a
matching `AUTH_SECRET` with the collaboration service.

## Deploy on Vercel

Create a Vercel project for this monorepo and set **Root Directory** to
`apps/web`. The [`vercel.json`](vercel.json) install and build commands install
from the Bun workspace root and run the app through Turborepo, so the database
contract is generated before Next.js builds. Leave Vercel's Next.js output
settings at their defaults.

Set these Vercel environment variables for the environments where the app will
run:

- `DATABASE_URL`: PostgreSQL connection string. Use your database provider's
  pooled/serverless connection URL for the web app, and keep production and
  preview databases separate. It is also read during the build, but the build
  does not connect to PostgreSQL.
- `AUTH_SECRET`: a random secret with at least 32 characters. Use the same
  value in the collaboration service.
- `NEXT_PUBLIC_COLLAB_URL`: public `wss://` URL for the collaboration service.
- `NEXT_PUBLIC_SITE_URL`: canonical public app URL, if it differs from the
  Vercel deployment URL.
- `REDIS_URL`: optional Redis URL. Configure it when the collaboration service
  needs a shared document cache or Pub/Sub relay.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`,
  and `R2_PUBLIC_URL`: configure these together to enable profile photo uploads.
- `DEBUG_MODE`: optional; set to `true` only when diagnostic logs are wanted.

Before routing traffic to a new database, provision its schema from the
repository root with `bun db:push` only for a new/empty database, or apply a
reviewed migration with `bun db:migrate:deploy`. Do not run `db:push` against a
database with data you need to keep. The repository currently contains Prisma
contract snapshots but no executable migration packages, so `db:migrate:deploy`
does not yet create the initial schema from scratch. Establish and verify the
initial schema before using it for production; keep future schema changes in
reviewed migrations and apply them once in your deployment pipeline, not from
every Vercel function instance.

Vercel runs the Next.js app only. Deploy `apps/ws` as a separate persistent Bun
service and point `NEXT_PUBLIC_COLLAB_URL` to it; the WebSocket service is
long-lived and is not suitable for Vercel serverless functions. Redis can relay
room updates between processes, but simultaneous edits across multiple
WebSocket processes are not yet reliable. See the root README for the
architecture and current limitations.
