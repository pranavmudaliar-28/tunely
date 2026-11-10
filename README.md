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
| `pnpm stats [--days N]`            | Daily playback totals (last 14 days)     |

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
# Takedown in production (also clears the API cache, which the CLI can't reach on Render):
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H "content-type: application/json" \
  -d '{"ids":["Foo.us"],"status":"removed","reason":"DMCA"}' https://<api-host>/v1/admin/curate
```

The worker also runs the sync daily at 02:30 UTC. New channels land as `pending`; nothing is public until approved.
Tests that touch Postgres use `TEST_DATABASE_URL` (`createdb tunely_test`, then `pnpm --filter @tunely/db migrate <url>`).

## Web app

- `pnpm dev`, then open http://localhost:3000 (needs a synced, health-checked catalog and some approved channels; see above).
- `pnpm --filter @tunely/worker health:once` checks every due stream now (~25 min for the full catalog).
- `pnpm --filter @tunely/web e2e` runs Playwright against the running stack in your installed Chrome. Start the api and web with the same `INTERNAL_API_KEY` (any value) so server renders skip the 120/min limit; without it the suite hits 429s and fails at random. Against `next start`, rebuild with the API running, or the home page is prerendered empty. Run the tests with the same `INTERNAL_API_KEY` too (the guide test looks through many channels). To use other ports (e.g. when port 3000 is taken), set `E2E_BASE_URL` and `E2E_API_URL`, start the API with `API_PORT` and `CORS_ORIGINS` for that web origin, and build the web with `NEXT_PUBLIC_API_URL`/`API_URL` pointing at it.
- `pnpm --filter @tunely/worker guide:once` fetches the programme guide now (Now & Next, from i.mjh.nz; the worker also does it every 6 hours).
- `pnpm stats` prints daily plays, success rate, start time (p50/p90), returning-visitor share and the top error. Rows are written once a day from the hourly scoring job, so the first appears the day after reports start.
- `MANUAL=1 pnpm --filter @tunely/web e2e` plays 50 random web-playable streams (`/dev/stream-test`) and asserts at least 80% succeed.
- `pnpm --filter @tunely/api bench` measures cached API latency.

`/guide` lists what's on now and next on every live channel with a guide, by category (`/guide/{category}` for all of one). Channel cards and search results say "Now: …" for those channels. "Remind me" next to an upcoming programme adds it to your calendar with a 5-minute alarm (a .ics file; Google Calendar on Android). The watch page shows what's on now and next where a guide exists, and a Cast button (Chrome, when a Chromecast or Google TV is on the network) or AirPlay (iPhone, iPad). Keyboard and TV remote on the watch page: ↑/↓ channel up/down, G channel list, L last channel, 1–9 your favorites, ←/→ 10 s (when the stream allows), F fullscreen, M mute, Space pause, ? all shortcuts; Ctrl/⌘+K search anywhere (or the search button in the header on phones and in the left rail on desktop). Elsewhere the arrow keys move between channel cards, rails and the nav. Headset and lock-screen previous/next buttons change channel; on phones in fullscreen, swipe up/down changes channel and a double tap on either side skips 10 s.

`/multiview` plays up to 4 live channels side by side (480p each, sound from the one you pick with Listen or keys 1–4); the channels are in the URL (`?c=id1,id2`), and the watch page's Multi-view button starts one. If a playing channel shows a frozen or black picture with no sound for 20 seconds, the watch page offers the next channel (it never switches by itself).

Pages in the browser only: `/history` (remove one channel or clear all) and `/settings` (up to 3 languages, country, data saver). The product roadmap is in [docs/roadmap.md](docs/roadmap.md).

## Earning (Adsterra, donations, affiliates)

All off until their env vars are set; step-by-step setup in [docs/monetization.md](docs/monetization.md). Adsterra banners fill the ad spots only while AdSense isn't configured.

## Ads (Google AdSense)

Full checklist, including what gets sites rejected: [docs/adsense.md](docs/adsense.md).

1. Before applying, set `NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-…` so reviewers can see the AdSense code. After approval, add an ad unit id (`NEXT_PUBLIC_ADSENSE_SLOT`, or one per placement: `_HOME`, `_BROWSE`, `_WATCH`) and redeploy.
2. `/ads.txt` and the AdSense verification meta tag are generated automatically.
3. In AdSense → Privacy & messaging, enable the consent message for EEA/UK visitors.

Search Console: set `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` to the HTML-tag code, redeploy, verify, then submit `/sitemap.xml`.

With no publisher id, no ad code loads; in development dashed boxes show where ads will appear.
