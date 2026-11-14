# Conflux

Conflux is a collaborative workspace with workspaces, role-based membership,
rich-text pages, comments, and version history. The web app is in `apps/web`,
the Yjs WebSocket service is in `apps/ws`, and the Prisma ORM contract and
database client are in `packages/database`.

## Requirements

- Node.js 26.12.1 or newer
- Bun 1.4.0
- Docker Compose, or a reachable PostgreSQL database

## Local setup

Install dependencies and create local environment files:

```sh
bun install
cp .env.example .env
cp .env.example packages/database/.env
cp .env.example apps/web/.env
```

The example environment uses local-only credentials. Change them before using
the application outside local development. Set `AUTH_SECRET` to a random value
of at least 32 characters; the placeholder in `.env.example` is rejected by
the app. The WebSocket service reads the root `.env`; the database package and
web app read their own `.env` files.

Start PostgreSQL and Redis for the local Compose setup:

```sh
docker compose up -d
```

Redis is optional and used only as a cache. PostgreSQL is the durable source of
truth. Initialize the database contract and apply it locally:

```sh
bun generate
bun db:push
```

Then start the web and collaboration services:

```sh
bun dev
```

Open <http://localhost:3000>. The collaboration service listens on port 8008
by default; set `NEXT_PUBLIC_COLLAB_URL` if it runs at another address.

## Current deployment limits

Run one web app process and one long-lived collaboration WebSocket process.
Active Yjs rooms are held in memory, so multiple collaboration replicas do not
synchronize and are unsupported. The multi-instance Redis Pub/Sub requirement
in `SPEC.md` is not implemented. Use a host that supports persistent processes
and long-lived WebSocket connections; the collaboration service is not suitable
for a serverless function.

Automatic snapshots are off by default for each page. Owners and Admins can
enable them from a page's sidebar menu. The collaboration process checks for
eligible pages every 30 seconds and keeps up to 20 automatic snapshots per
page. It snapshots persisted document updates, so edits not yet committed to
PostgreSQL are not included in that snapshot.

The current app does not persist offline edits in browser storage. A connected
client can reconnect and synchronize its in-memory Yjs document, but edits are
not guaranteed to survive a page reload or browser crash while offline.
Comments use stored selection offsets and quoted text; anchors are not
transformed as the document changes. Comment changes are not pushed to other
open clients in real time.

## Database and checks

After changing the Prisma contract, use `bun db:push` for local development.
For a deployment, generate a migration with the Prisma migration workflow and
apply it with:

```sh
bun db:migrate:deploy
```

Other available commands:

```sh
bun build
bun lint
bun check-types
bun db:seed
```

See [`SPEC.md`](./SPEC.md) for the product target, [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md)
for planned work and scope decisions, and [`IMPLEMENTATION_REPORT.md`](./IMPLEMENTATION_REPORT.md)
for the current implementation summary.
