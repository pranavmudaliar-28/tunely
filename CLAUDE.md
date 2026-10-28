# Tunely — project rules for Claude Code

## What we are building

A web app where users watch free, publicly available live TV channels in the
browser without VLC. The catalog comes from the iptv-org API
(https://iptv-org.github.io/api/*.json: channels, feeds, streams, logos,
categories, countries, languages, blocklist, guides), synced daily into our
own PostgreSQL database, health-checked, and curated before it is shown.
The same API will later serve Android, Android TV and iOS apps.

## Non-negotiable rules

- We never proxy, re-host, record or download video. We only link streams.
- Public endpoints read only from the `public_channels` view
  (approved, not nsfw, not blocklisted, not closed, web_playable stream with score >= 50).
- New channels from sync start as `pending`. Nothing goes public automatically.
- Treat every value from iptv-org as untrusted: validate with Zod, allow only
  http/https stream URLs, block private/loopback IPs in any server-side fetch.
- Do not store IP addresses. Use a daily-rotating salted hash where de-duplication is needed.
- No secrets in code. Use env vars and keep `.env.example` updated.

## Stack (use latest stable versions, pin exact versions)

- Monorepo: Turborepo + pnpm. apps/web, apps/api, apps/worker,
  packages/shared, packages/db, packages/config.
- Web: Next.js App Router, TypeScript strict, Tailwind CSS, shadcn/ui, hls.js,
  TanStack Query, Zustand, TanStack Virtual, idb-keyval.
- API: Fastify + TypeScript, Zod schemas -> OpenAPI, pino logging.
- DB: PostgreSQL + Drizzle ORM (migrations via drizzle-kit), pg_trgm for search.
- Jobs: Redis + BullMQ in apps/worker.
- Auth: Better Auth (email magic link + Google). Admin requires 2FA.
- Tests: Vitest, Testing Library, Playwright. CI: GitHub Actions.
- Local dev: docker compose (postgres, redis) + pnpm dev.

## Design system

- Dark-first. Tokens as CSS variables in apps/web/styles/tokens.css mapped into Tailwind.
- Tokens: --bg #0B0D12, --surface #151922, --surface-raised #1E2330, --border #2A3040,
  --text #F2F4F8, --text-muted #9AA3B5, --accent #FF4D4F, --live #FF3B30,
  --success #22C55E, --warning #F59E0B. Provide a light theme too.
- Font: Inter + Noto Sans fallbacks for Indian scripts via next/font.
- 4px spacing grid, 8px card radius, 12px player radius.
- Every interactive element works by keyboard/D-pad with a visible focus ring.
  No hover-only actions. WCAG AA contrast.
- Reference screens: design canvas "Tunely UI Screens"
  (https://claude.ai/artifact/65K5XKzHGoK7husDQ7azz7).

## Player behaviour

- hls.js when supported, native HLS fallback (Safari/iOS).
- Destroy the hls instance on every channel change.
- Distinct UI states: loading, playing, offline, geo-blocked, browser-blocked; offer "Try next channel".
- Send a playback report (result, error type, time to first frame) for every attempt.
- Shortcuts: arrows = channel up/down, F = fullscreen, M = mute, Space = pause.

## Security

- Strict CSP (media-src https: blob:), HSTS, nosniff, Referrer-Policy,
  Permissions-Policy, frame-ancestors none.
- Rate limits in Redis: 120/min public API, 20/min playback reports, 5/hour takedown form.
- Health checker: isolated, 10s timeout, max 3 redirects, size caps, private
  IP blocking after DNS resolution.
- Admin routes check role server-side on every request and write an audit log.

## How to work

- Work one phase at a time. Before coding, write a short plan and list files you will touch.
- Keep functions small, typed, and tested. Add tests with every feature.
- After each phase: run typecheck, lint, tests and build; fix everything before saying done.
- Update README.md (setup, scripts, env vars) and docs/decisions.md (any choice you made and why).
- Ask me before adding a new paid service or a dependency larger than a utility library.
