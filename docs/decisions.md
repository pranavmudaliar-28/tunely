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
- **NAT64-aware SSRF check.** On DNS64 networks public IPv4 hosts resolve to `64:ff9b::/96`; the fetcher judges the embedded IPv4 address instead of refusing the whole range. Before this fix 3,155 streams were wrongly marked `blocked_ip`.
- **Segment check reads the first 32 KB** of one segment (cap 5 MB), enough to prove it's served without downloading video at scale.
- **Hand-rolled m3u8 parsing** (~40 lines) instead of `m3u8-parser`: we only need variants, resolution and one segment URI.
- **Score** = 80 × recency-weighted check success + 20 for a fast manifest, blended 60/40 with player reports once there are ≥ 5 in 24 h; a failed latest check caps it at 40 (below the public threshold of 50). See `apps/worker/src/health/score.ts`.
- **Playback reports go through a Redis list** (`playback-reports:buffer`, capped at 100k) and the worker flushes them every 10 s in batches; simpler than one BullMQ job per report.
- **Rate-limit keys use a hash of the client IP**, held in Redis only for the 1-minute window. Fastify request logs omit IPs and user agents.
- **Takedown endpoint moved to Phase 5** with its Turnstile form.
- **Each package tests against its own database** (`<TEST_DATABASE_URL>_api`, `_worker`), created and migrated by a vitest global setup, so turbo runs them in parallel.
- **Measured (local, 2026-10-28):** full catalog sync 40 s; full health check of 16,031 streams ≈ 25 min at concurrency 100; 50-stream browser sample in Chrome: 45/50 played (90%); cached API p95 4–7 ms, cold first page up to ~470 ms.
