# Collaboration WebSocket service

This Bun service hosts one in-memory Yjs room per active page, authenticates
connections with the web app's signed WebSocket token, persists accepted Yjs
updates to PostgreSQL, and relays document and awareness updates among clients
connected to this process.

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

Run exactly one persistent collaboration process. Room state is in memory;
this service does not implement Redis Pub/Sub or cross-process room
synchronization. PostgreSQL is the source of truth and Redis, when configured,
is only a document cache. The package currently defines a development script;
it has no separate production start or health-check command.
