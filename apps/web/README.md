# Conflux web app

Follow the repository [setup instructions](../../README.md) to install Bun
dependencies, configure environment files, start PostgreSQL, apply the database
contract, and run the web app together with the collaboration WebSocket service.

From the repository root, use `bun dev` for development. The Next.js app runs
on port 3000 by default. It requires a reachable PostgreSQL database and a
matching `AUTH_SECRET` with the collaboration service.

For deployment, keep the web app and one persistent collaboration process
available to clients. The collaboration service keeps active rooms in memory
and does not synchronize multiple replicas; see the root README for current
deployment limits.
