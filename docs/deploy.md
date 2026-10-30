# Deploying Tunely

Website on **Vercel**; API, worker, Postgres and Redis in one **Railway** project; domain and DNS on **Cloudflare**.
Video never touches these servers, so hosting only serves pages, JSON and logos.

```
Browser ──► yourdomain.com (Vercel: Next.js)
        └─► api.yourdomain.com (Railway: API) ──► Postgres, Redis   (Railway private network)
                                  Worker (Railway) ──┘   syncs iptv-org daily, health-checks streams
```

Do the steps in order: the website build calls the live API.

## 1. Accounts and domain

1. **GitHub**: the code must be in a GitHub repository (private is fine). Vercel and Railway deploy from it.
2. **Domain**: buy one at Cloudflare (Domain Registration → Register; sold at cost, about $10/yr for a .com).
   Bought elsewhere? Add the site to Cloudflare (free plan) and change the nameservers at your registrar.
3. **Railway** (railway.com) and **Vercel** (vercel.com): sign in with GitHub.
   Railway needs the Hobby plan ($5/month including $5 of usage) for always-on services.

## 2. Railway: database, Redis, API, worker

1. **New Project → Deploy PostgreSQL.** Then in the same project **+ New → Database → Redis**.
2. **+ New → GitHub Repo →** your repo. Name the service `api`.
   Settings → **Config-as-code file path**: `apps/api/railway.json`. Leave Root Directory empty (the Dockerfile builds from the repo root).
3. Same again for a second service named `worker`, config file `apps/worker/railway.json`.
4. Variables (Service → Variables). Generate secrets with
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

   | Variable             | `api`                                               | `worker`                     |
   | -------------------- | --------------------------------------------------- | ---------------------------- |
   | `DATABASE_URL`       | `${{Postgres.DATABASE_URL}}`                        | `${{Postgres.DATABASE_URL}}` |
   | `REDIS_URL`          | `${{Redis.REDIS_URL}}`                              | `${{Redis.REDIS_URL}}`       |
   | `NODE_ENV`           | `production`                                        | `production`                 |
   | `ADMIN_TOKEN`        | a generated secret                                  | –                            |
   | `REPORT_HASH_SECRET` | a generated secret                                  | –                            |
   | `INTERNAL_API_KEY`   | a generated secret, same value on the web server    | –                            |
   | `CORS_ORIGINS`       | `https://yourdomain.com,https://www.yourdomain.com` | –                            |
   | `TRUST_PROXY`        | `true`                                              | –                            |

5. **Deploy.** The API runs database migrations before it goes live (`preDeployCommand`) and must pass `/v1/health`.
   On its first start the worker sees an empty catalog and imports iptv-org (~1 min). Stream health checks run
   1,000 streams every 15 minutes, so the full catalog is checked within about 4 hours; channels show as live
   as their streams pass.
6. **API domain:** `api` → Settings → Networking → **Custom Domain** → `api.yourdomain.com`.
   Railway shows a CNAME target. In Cloudflare → DNS → add that **CNAME** for `api`, **Proxy status: DNS only**
   (grey cloud). HTTPS is issued automatically within minutes.
7. Check: `https://api.yourdomain.com/v1/health` → `{"status":"ok"}`, and `/v1/docs` shows the API docs.

## 3. Vercel: the website

1. **Add New → Project →** import the repo.
2. **Root Directory:** `apps/web` (Vercel detects Next.js and pnpm; keep "Include files outside the root directory" on).
3. Environment variables (Production):

   | Variable                     | Value                                 |
   | ---------------------------- | ------------------------------------- |
   | `NEXT_PUBLIC_API_URL`        | `https://api.yourdomain.com`          |
   | `API_URL`                    | `https://api.yourdomain.com`          |
   | `NEXT_PUBLIC_SITE_URL`       | `https://yourdomain.com`              |
   | `NEXT_PUBLIC_ADSENSE_CLIENT` | empty until AdSense approves the site |

4. **Deploy.** Then Settings → Domains → add `yourdomain.com` and `www.yourdomain.com`. Vercel shows the DNS
   records (an `A` record for the apex, a `CNAME` for www): add them in Cloudflare as **DNS only**.

## 4. After the first deploy

- Open the site, play a channel, open picture-in-picture, and check `https://yourdomain.com/sitemap.xml`.
- Submit the sitemap in Google Search Console.
- **Curation in production:** run the curate CLI from your machine against the production database:
  `DATABASE_URL="<Railway Postgres public URL>" pnpm --filter @tunely/worker curate hide --id Foo.us --reason "takedown"`
  (Postgres → Connect → public URL). Trigger a catalog sync any time with
  `curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" https://api.yourdomain.com/v1/admin/sync`.
- **AdSense:** apply with the live domain; once approved set `NEXT_PUBLIC_ADSENSE_CLIENT` and the ad unit ids in
  Vercel and redeploy. Turn on the EEA/UK consent message in AdSense → Privacy & messaging.
- Every `git push` to `main` redeploys whatever changed (Railway watches the paths in each `railway.json`).

## Before announcing the site publicly (Phase 6)

Not done yet, and worth doing before real traffic or an AdSense application:

- Privacy policy, terms and DMCA/takedown pages (AdSense requires a privacy policy).
- Security headers and CSP (must allow the AdSense and stream hosts).
- Error tracking (Sentry), uptime checks on `/v1/health`, and Postgres backups (Railway → Postgres → Backups).
- Cloudflare proxy (orange cloud) in front of the API for DDoS protection, once the above is settled.

## Costs (check current pricing)

Vercel Hobby is free for personal, non-commercial use; a site with ads counts as commercial, so plan on Vercel Pro
($20/month) or move the website to Railway too. Railway is usage-based: expect roughly $10–25/month for the API,
worker, Postgres and Redis at low traffic. Domain about $10/year.
