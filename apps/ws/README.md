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

The package currently defines a development script, but no separate production
start or health-check command. See the root [README](../../README.md) for the
system overview, setup steps, and current limitations.
