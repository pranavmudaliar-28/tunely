# Deploying Tunely free, with no credit card

| Piece                      | Service (free plan, no card) | Address you get                   |
| -------------------------- | ---------------------------- | --------------------------------- |
| Website                    | **Vercel** Hobby             | `https://<project>.vercel.app`    |
| API + worker (one service) | **Render** free web service  | `https://tunely-api.onrender.com` |
| Redis (job queues, cache)  | **Render** free Key Value    | private                           |
| Postgres                   | **Neon** free                | private connection string         |
| Keep-awake pinger          | **cron-job.org** free        | –                                 |

Free limits shape the setup (checked October 2026; free tiers change, so re-check before relying on them):

- **Render** free services sleep after 15 minutes without visitors and take about a minute to wake. A free cron
  job pings `/v1/health` every 10 minutes, so it stays awake. Only one service can stay awake all month (750 hours),
  so the API and the worker run together in it. Render can restart free services at any time; Tunely recovers
  on its own. Free Key Value loses its data on restart, which only costs queued jobs and cache.
- **Neon** free gives 1 GB of storage (Tunely uses ~100 MB) and 100 compute-hours a month. A database awake 24/7
  would use ~180, so the stream checker runs every 30 minutes instead of every 15 and Neon sleeps in between.
  The `/v1/health` ping never touches the database. Pages are cached for 5 minutes, so visitors wake it only occasionally.
- **Vercel** Hobby is for **non-commercial** use. Before turning on ads, move the website to Vercel Pro or another host.

## 1. Neon (database)

1. Sign up at **neon.com** with GitHub or Google.
2. Create a project: name `tunely`, Postgres 16, region **AWS Asia Pacific (Singapore)**.
   Region matters: Render runs in Singapore, and a US database adds ~200 ms to every query.
3. Dashboard → **Connect** → copy the connection string (it looks like
   `postgresql://neondb_owner:…@ep-….ap-southeast-1.aws.neon.tech/neondb?sslmode=require`). Keep it for step 2.

## 2. Render (API + worker + Redis)

1. Sign up at **render.com** with GitHub and allow access to the `tunely` repository.
2. **New → Blueprint →** pick the `tunely` repo. Render reads `render.yaml` and proposes:
   `tunely-api` (free web service, Singapore) and `tunely-redis` (free Key Value).
3. It asks for the two values marked "sync: false":
   - `DATABASE_URL`: the Neon connection string from step 1.
   - `CORS_ORIGINS`: leave as `https://tunely.vercel.app` for now; you'll correct it after step 3.
4. **Apply.** The first build takes ~10 minutes. On start the service applies migrations and imports the
   channel catalog (~1–2 minutes); channels then turn Live as the checker works through them (~a day on the
   free schedule, best channels first).
5. Check `https://tunely-api.onrender.com/v1/health` → `{"status":"ok"}` (use the URL Render shows for your service).

## 3. Vercel (website)

1. Sign up at **vercel.com** with GitHub. **Add New → Project →** import `tunely`.
2. **Root Directory:** `apps/web`. Vercel detects Next.js and pnpm.
3. Environment variables:

   | Variable               | Value                                                                            |
   | ---------------------- | -------------------------------------------------------------------------------- |
   | `NEXT_PUBLIC_API_URL`  | your Render URL, e.g. `https://tunely-api.onrender.com`                          |
   | `API_URL`              | the same                                                                         |
   | `NEXT_PUBLIC_SITE_URL` | `https://<project>.vercel.app` (shown after the first deploy; redeploy once set) |

4. **Deploy.**
5. Back in Render → `tunely-api` → Environment: set `CORS_ORIGINS` to your exact Vercel address (no trailing slash). Save; it redeploys.

## 4. Keep the API awake (free cron job)

Render puts a free service to sleep after 15 minutes without requests, and the worker inside it sleeps too.
A scheduled ping every 10 minutes keeps both running. The API has two endpoints for this (use your own Render URL):

| Endpoint             | Use it for                          | What it checks                                                                      |
| -------------------- | ----------------------------------- | ----------------------------------------------------------------------------------- |
| `/v1/health`         | **Keep-awake ping**, every 5–10 min | Nothing: answers instantly                                                          |
| `/v1/health/details` | **Alerts**, every 15–30 min         | Redis answers and the worker sent a heartbeat in the last 3 minutes; **503** if not |

Neither touches Postgres, so pinging doesn't use Neon's free compute hours. Both skip rate limits and accept
GET or HEAD.

**cron-job.org (free, no card):**

1. Sign up at **cron-job.org**.
2. **Create cronjob:** title `Tunely keep-awake`, URL `https://tunely-api.onrender.com/v1/health`,
   schedule **every 10 minutes**, request timeout 30 seconds (the first request after a sleep can take about a
   minute; the next run succeeds). Save.
3. Optional alert job: URL `https://tunely-api.onrender.com/v1/health/details`, every 30 minutes, and under
   **Notifications** enable "notify me when execution fails". A failure (503) means Redis or the worker has a
   problem.

**UptimeRobot** works too (HTTP(s) monitor on `/v1/health`, every 5 minutes). One pinger is enough.

Check it yourself any time: `curl https://tunely-api.onrender.com/v1/health/details` returns something like
`{"status":"ok","uptimeSeconds":5321,"redis":"ok","worker":{"status":"ok","lastSeenSecondsAgo":12}}`.
An `uptimeSeconds` that keeps resetting means Render is restarting the service; it recovers on its own.

## After it's live

- Every `git push` to `main` redeploys Render and Vercel automatically.
- Catalog sync on demand:
  `curl -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" https://tunely-api.onrender.com/v1/admin/sync`
  (`ADMIN_TOKEN` was generated by Render: tunely-api → Environment).
- Hide a channel (takedown): Neon → SQL Editor:
  `update channel_curation set status='removed', reason='takedown' where channel_id='Foo.us'; select refresh_public_channels();`
- Neon free has no point-in-time restore beyond its short history window; export now and then with
  `pg_dump "<connection string>" -Fc -f tunely.dump`.

## What you give up versus a paid or self-hosted setup

- About a minute of "waking up" if the pinger ever misses and the API falls asleep.
- Channel health is refreshed every ~12 hours instead of every 4.
- No ads on the Vercel free plan, and AdSense needs your own domain (~$10/year).
- When you outgrow it: `docs/deploy-free.md` (one server) or `docs/deploy.md` (Vercel Pro + Railway).
