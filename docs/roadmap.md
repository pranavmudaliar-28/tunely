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

## Phase 2: feels like TV (about 4–6 weeks)

| ID       | Feature                                                                                                | Size |
| -------- | ------------------------------------------------------------------------------------------------------ | ---- |
| H4 + Q9  | Channel list inside the player (G); last-channel recall (L); 1–9 jump to favorites; `?` shortcut sheet | M    |
| H5       | Faster switching: prefetch neighbouring channels' playlists, rank streams by start time                | M    |
| H6       | Phone gestures in fullscreen: swipe to change channel, double-tap ±10 s, fit/fill                      | M    |
| H7       | Cast (Chromecast Web Sender) and AirPlay button                                                        | M    |
| H8       | Captions and audio-language menu when the stream carries them                                          | L–M  |
| H9       | Data saver: cap at 480p on mobile data; audio-only                                                     | L–M  |
| H10      | Reliability line on watch pages ("online 97% of the last 7 days")                                      | L–M  |
| H11      | TV mode and arrow-key navigation between cards and rails                                               | M    |
| H12      | "For you" row built on the device from history                                                         | M    |
| A1       | Smart search v1: "tamil kids", "hindi news" become filters (rules, no AI)                              | M    |
| H1 spike | Measure programme-guide coverage for the top 200 live channels (1 week)                                | –    |

## Phase 3: knows what's on, everywhere (about 2–3 months)

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

- **Programme guide data:** iptv-org no longer publishes ready-made guides. Either run their grabber, which scrapes listing sites and needs a machine such as the Oracle free box, or use community XMLTV feeds. Both carry terms-of-service risk.
- **Cast:** the Google Cast sender script, which needs a CSP allowance in Phase 6.
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
