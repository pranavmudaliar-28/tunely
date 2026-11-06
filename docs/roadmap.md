# Product roadmap

From the feature review of 6 Nov 2026. Each item builds on what Tunely already does and follows the rules in `CLAUDE.md`: no proxying or recording, no identifiers, free tiers, no ads on video. Why each choice was made is in [decisions.md](decisions.md).

**Positioning:** free live TV that actually plays: fast, in your language, no app, no account.

**North-star metric:** successful-play minutes per returning visitor per week (`pnpm stats`).

**Watch these:**

- start time p50 under 3 s;
- failed-play rate;
- the ad-placement rules.

## Phase 1: findable and sticky (done, 6 Nov 2026)

| ID  | Feature                                                                               |
| --- | ------------------------------------------------------------------------------------- |
| Q1  | Search button in the phone header and the desktop rail                                |
| Q2  | "Your channels" on Home: favorites, live first, "Back online"                         |
| Q3  | Volume, mute and quality kept between visits                                          |
| Q4  | Lock-screen and headset controls (Media Session)                                      |
| Q5  | `/history`: remove one channel, or clear all                                          |
| Q6  | "Report a problem" and "Request a channel" (pre-filled email)                         |
| Q7  | Browse sort: Best quality                                                             |
| Q8  | Closed channel links its successor                                                    |
| H3  | Languages and country: first-visit card, `/settings`, "Live in …" rows                |
| H2  | Playback metrics without identifiers: visitor-age bucket, `daily_stats`, `pnpm stats` |

## Phase 2: feels like TV (done, 6 Nov 2026, except H7)

| ID       | Feature                                                                                         |
| -------- | ----------------------------------------------------------------------------------------------- |
| H4 + Q9  | Channel list inside the player (G); last channel (L); 1–9 jump to favorites; `?` shortcut sheet |
| H5       | Faster switching: neighbouring channels prefetched; viewers' start time in the score            |
| H6       | Phone gestures in fullscreen: swipe to change channel, double-tap ±10 s, Fit/Fill               |
| H8       | Captions and audio-language menus when the stream carries them                                  |
| H9       | Data saver: Auto capped at 480p on mobile data or when chosen (audio-only not built)            |
| H10      | Reliability line on watch pages ("Worked in 13 of 14 checks this week")                         |
| H11      | Arrow keys move between cards, rails and the nav (a separate large-UI TV mode not built)        |
| H12      | "For you" row built on the device from history                                                  |
| A1       | Smart search v1: "tamil news", "kids", "sports uk" become filters (rules, no AI)                |
| H1 spike | Guide coverage measured: see below                                                              |

**H7 Cast and AirPlay:** done on 6 Nov 2026, owner approved. Phase 6's CSP must allow `https://www.gstatic.com`.

**Guide coverage (6 Nov 2026):**

- 38% of our 4,429 live channels have a guide source in iptv-org; 62% of the top 200; India 65%, US 42%.
- `i.mjh.nz` publishes ready XMLTV files and covers 42 of the top 200: start there, with no scraping.
- Indian channels mostly need iptv-org's grabber on `tataplay.com`, which scrapes the site: the owner's call.

## Phase 3: knows what's on, everywhere (started 6 Nov 2026)

Done: **H1 Now & Next on watch pages**, from i.mjh.nz only (owner decision: no scraping), about 300 live channels. Still to do for H1: "Now" on channel cards and in search.

| ID  | Feature                                                                      | Size |
| --- | ---------------------------------------------------------------------------- | ---- |
| H1  | Now & Next programme guide on watch pages, cards and search                  | H    |
| F1  | Accounts and sync across devices (the planned Phase 5)                       | H    |
| F2  | Service worker and opt-in web push ("back online", reminders)                | M–H  |
| A2  | Dead-air detection: black or frozen picture offers the next channel          | M    |
| A3  | Catalog quality checks (wrong category, duplicate, broken logo) for curators | M    |
| F3  | Multi-view, 2–4 channels (desktop and tablet)                                | H    |
| F4  | Programme reminders and a live-events page (needs H1)                        | M    |
| F5  | Android TV app first, then Android and iOS, on the same API                  | H    |
| A4  | Experiment: on-device live captions and translation                          | H    |

## Owner decisions needed

- **More guide coverage (India):** running iptv-org's grabber on `tataplay.com` and similar sites means scraping them; it needs a machine (e.g. the Oracle free box) and carries terms-of-service risk. Not done; the owner chose i.mjh.nz only for now.
- **Dead-air detection (A2):** needs audio analysis to tell a frozen picture from a radio channel's still image.
- **Paid AI:** an LLM for smart search v2 or catalog checks.
- **Large dependency:** the on-device speech model for A4.
- **Accounts:** when to start them.

## Not planned, and why

| Idea                                                      | Why not                                                              |
| --------------------------------------------------------- | -------------------------------------------------------------------- |
| Hover previews that autoplay on cards                     | They load third-party streams, burn mobile data, and depend on hover |
| Downloads, cloud DVR, catch-up, server-side transcription | We never record or download video                                    |
| Live chat, comments, watch parties                        | Moderation and legal load; reconsider after accounts                 |
| Streaks, badges, star ratings                             | Friction and weak signal; playback reports already measure quality   |
| Ads in the player, channel list or multi-view             | Against AdSense placement policy                                     |
