# Collaboration WebSocket service

This Bun service authenticates collaboration connections, hosts Yjs rooms for
active pages, persists accepted document updates to PostgreSQL, and broadcasts
document and awareness updates to connected clients. Redis optionally caches
serialized documents and relays live updates between processes. PostgreSQL is
the durable source of truth.

## Run locally

From the repository root, start all development services with `bun dev`, or
start only this service with:

```sh
bun --filter ws dev
```

The dev script reads `../../.env` and listens on `PORT` (default `8008`). Set
`AUTH_SECRET` to the same random secret used by the web app, and configure
`DATABASE_URL` and `NEXT_PUBLIC_COLLAB_URL` as described in the root
[`README.md`](../../README.md).

## Deployment boundary

Run one persistent WebSocket process for reliable collaboration. Each process
keeps its active rooms in memory. With `REDIS_URL`, Redis Pub/Sub relays live
document and awareness updates between processes, but messages are transient
and simultaneous edits handled by different processes can trigger the stale
room persistence check. PostgreSQL remains the durable source of truth.

## Docker deployment

Build the image from the repository root so Bun can resolve the workspace and
generate the Prisma contract:

```sh
docker build -t conflux-ws .
```

### Render setup

Create a Render **Web Service** using the Docker runtime. Set **Dockerfile
Path** to `Dockerfile` and **Docker Context Directory** to the repository root
(`.`). The root context is required: it must include `package.json`,
`bun.lock`, `apps/ws`, and `packages/database` for Bun workspace resolution.

Add `AUTH_SECRET` (at least 32 random characters) and `DATABASE_URL` in the
Render service's Environment settings. Add `REDIS_URL` only if you use Redis.
Render passes service variables to Docker builds as build args and injects them
into the running container. This Dockerfile does not declare or read secret
build args, so it does not embed those values in the image. Prisma contract
generation reads the checked-in schema and does not need `DATABASE_URL` or a
database connection during the image build; the real URL is used at runtime.

The server binds to `0.0.0.0` and reads Render's `PORT` at runtime (Render's
default is `10000`; outside Render, the app defaults to `8008`). Do not set
`PORT` to a different value in the Render dashboard unless needed. Render
supports WebSocket connections on web services, so set the web app's
`NEXT_PUBLIC_COLLAB_URL` to `wss://<your-render-service-host>`.

For a local smoke run, export the required variables first, then start it with:

```sh
docker run --name conflux-ws --restart unless-stopped -p 8008:8008 \
  -e AUTH_SECRET -e DATABASE_URL -e REDIS_URL conflux-ws
```

Run one WebSocket process for reliable collaboration. Each process keeps its
active rooms in memory. Redis Pub/Sub relays updates between processes, but
simultaneous edits across processes are not yet reliable. PostgreSQL remains
the durable source of truth. See the root [README](../../README.md) for the
system overview and current limitations.
