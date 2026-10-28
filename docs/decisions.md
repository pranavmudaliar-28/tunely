# Decisions

Choices made while building, newest last.

- **TypeScript 6.0.3, not 7.x.** TS 7 (native port) is the latest release, but typescript-eslint 8.72 supports only `<6.1.0` and needs the TS compiler API. Revisit when typescript-eslint supports 7.
- **Internal packages ship TypeScript source.** `@tunely/shared` and `@tunely/db` export `src/index.ts`. Next.js transpiles them (`transpilePackages`); the API and worker run with `tsx` in dev and are bundled with esbuild for production, so no per-package build step or watch process is needed.
- **`moduleResolution: Bundler` everywhere.** Every runtime path goes through a bundler or tsx, so extensionless imports work and Next/Turbopack resolves them the same way.
- **pnpm installed with `npm i -g pnpm`.** `corepack enable` fails without admin rights on Windows (EPERM in Program Files).
- **Postgres on host port 5433 locally.** 5432 is often taken by other projects; override with `POSTGRES_PORT`.
- **Sync upserts only rows whose values changed** (`ON CONFLICT … DO UPDATE … WHERE row IS DISTINCT FROM excluded`), so a re-run writes nothing. Channels that leave iptv-org, become blocklisted or NSFW are deleted with their feeds, streams, logos, health and curation rows.
- **Streams with `channel: null` are skipped.** About 1,900 iptv-org streams aren't mapped to a channel, so they can't be curated or shown.
- **`stream_checks` is range-partitioned by month** in hand-edited SQL (Drizzle can't express partitions). A `DEFAULT` partition catches stray rows; `ensure_stream_checks_partition(ts)` creates monthly partitions.
- **Admin endpoints use a single bearer `ADMIN_TOKEN` until Phase 5.** The value `change-me` is treated as unset, so admin is closed by default.
- **Curation via `curate` CLI until the admin UI exists.**
