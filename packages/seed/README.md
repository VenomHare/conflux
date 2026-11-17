# Demo data seed package

This package creates a small, repeatable dataset for local product demos:

- `owner@conflux.local` as the workspace owner
- `editor@conflux.local` as an editor
- A `Conflux Demo Workspace` workspace
- A `Welcome to Conflux` page

Run `bun db:seed` from the repository root. Newly created demo accounts use
`conflux-demo` by default. To override it, set `SEED_DEMO_PASSWORD` to a
password of at least 12 characters. The script preserves existing account
passwords and does not duplicate the workspace, membership, or page when run
again.

Use these fixtures for local development and review environments.
