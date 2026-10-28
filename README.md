# Tunely

Free, publicly available live TV in the browser. Catalog from [iptv-org](https://github.com/iptv-org/iptv), synced daily, health-checked and curated before anything is shown. We never proxy or host video.

## Layout

| Path              | What                                        |
| ----------------- | ------------------------------------------- |
| `apps/web`        | Next.js site (App Router, Tailwind, hls.js) |
| `apps/api`        | Fastify REST API under `/v1`                |
| `apps/worker`     | BullMQ jobs: catalog sync, health checks    |
| `packages/shared` | Zod schemas and types shared by every app   |
| `packages/db`     | Drizzle schema, client and migrations       |
| `packages/config` | tsconfig, ESLint config                     |

## Setup

Needs Node 22+, pnpm 12 and Docker.

```sh
cp .env.example .env          # then set ADMIN_TOKEN and REPORT_HASH_SECRET
pnpm install
docker compose up -d          # postgres + redis
pnpm db:migrate
pnpm dev                      # web :3000, api :4000, worker
```

## Scripts

| Script                             | Does                                     |
| ---------------------------------- | ---------------------------------------- |
| `pnpm dev`                         | Runs web, api and worker in watch mode   |
| `pnpm build`                       | Production build of every app            |
| `pnpm typecheck` / `lint` / `test` | Checks run in CI                         |
| `pnpm db:generate`                 | Generate a migration from schema changes |
| `pnpm db:migrate`                  | Apply migrations                         |

**Deploying:** free with no card, see [docs/deploy-free-nocard.md](docs/deploy-free-nocard.md); free on one always-on server, see [docs/deploy-free.md](docs/deploy-free.md); or managed services (Vercel + Railway), see [docs/deploy.md](docs/deploy.md).

## Environment variables

See `.env.example`; every variable is documented there.

## Catalog and curation

```sh
pnpm --filter @tunely/worker sync:once                          # import iptv-org now (~40 s)
pnpm --filter @tunely/worker curate approve --country IN --category news
pnpm --filter @tunely/worker curate approve --id DWNews.de --id France24.fr
pnpm --filter @tunely/worker curate hide --id Foo.us --reason "pay-tv"
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" localhost:4000/v1/admin/sync   # enqueue a sync
```

The worker also runs the sync daily at 02:30 UTC. New channels land as `pending`; nothing is public until approved.
Tests that touch Postgres use `TEST_DATABASE_URL` (`createdb tunely_test`, then `pnpm --filter @tunely/db migrate <url>`).

## Web app

- `pnpm dev`, then open http://localhost:3000 (needs a synced, health-checked catalog and some approved channels; see above).
- `pnpm --filter @tunely/worker health:once` checks every due stream now (~25 min for the full catalog).
- `pnpm --filter @tunely/web e2e` runs Playwright against the running stack in your installed Chrome.
- `MANUAL=1 pnpm --filter @tunely/web e2e` plays 50 random web-playable streams (`/dev/stream-test`) and asserts at least 80% succeed.
- `pnpm --filter @tunely/api bench` measures cached API latency.

Keyboard: ↑/↓ channel up/down, F fullscreen, M mute, Space pause, Ctrl/⌘+K search.

## Ads (Google AdSense)

1. Get the site approved in AdSense, then set `NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-…` and an ad unit id (`NEXT_PUBLIC_ADSENSE_SLOT`, or one per placement: `_HOME`, `_BROWSE`, `_WATCH`) in `.env`, and restart.
2. `/ads.txt` and the AdSense verification meta tag are generated automatically.
3. In AdSense → Privacy & messaging, enable the consent message for EEA/UK visitors.

With no publisher id, no ad code loads; in development dashed boxes show where ads will appear.
