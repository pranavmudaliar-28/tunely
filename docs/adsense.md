# Getting Tunely approved for AdSense, and growing traffic

AdSense rejects most sites for one of a few reasons. This is the checklist for Tunely, in order.

## 1. Things that block approval no matter what

| Problem                                 | Why AdSense says no                                                                                                                                                                             | Fix                                                                                                                                                                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Site is on `tunely-tv.vercel.app`**   | AdSense only accepts a site whose root domain you control. ads.txt must be at the root of _your_ domain, and `vercel.app` belongs to Vercel. Expect "Site isn't supported" or an ads.txt error. | Buy a domain (.com, .in or .online, about ₹100–900 for the first year), add it in Vercel → Settings → Domains, set `NEXT_PUBLIC_SITE_URL=https://yourdomain` on Vercel and `CORS_ORIGINS` on Render, then redeploy. |
| **Copyrighted content**                 | AdSense doesn't allow ads on sites that link to unauthorised streams. iptv-org lists public streams, but some may still be copyrighted.                                                         | Keep the Copyright/DMCA page, answer takedowns fast (set the channel to `removed` in admin), and consider hiding premium sports and movie channels.                                                                 |
| **Not enough real content or visitors** | "Low-value content" or "site not ready".                                                                                                                                                        | Wait until Google has indexed the site (step 3) and real people visit it.                                                                                                                                           |

## 2. Already done in the code

- About, Privacy, Terms, Contact and Copyright/DMCA pages, linked in the footer.
- The privacy policy includes the disclosures AdSense requires: Google cookies, opt-out links, EEA/UK consent.
- Every watch, country, category and language page has real descriptive text, not only a player or a grid.
- Ads appear only next to content and never on or over the video.
- `/ads.txt` and the `google-adsense-account` meta tag, generated from `NEXT_PUBLIC_ADSENSE_CLIENT`.
- Sitemap, canonical URLs, noindex on dead channels, and structured data (channels, breadcrumbs, FAQ, site search).

## 3. Get indexed by Google (do this first, it's free)

1. Go to <https://search.google.com/search-console> → Add property → **URL prefix** → your site URL.
2. Choose **HTML tag**, copy only the `content="…"` value, and set it on Vercel as
   `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`. Redeploy, then click Verify.
3. Sitemaps → submit `sitemap.xml`.
4. Wait until **Pages → Indexed** shows a few hundred pages (usually 1–4 weeks).

## 4. Apply to AdSense

1. AdSense → Sites → Add site → your domain.
2. On Vercel, set `NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-…` (your publisher id) and redeploy. Check that
   `https://yourdomain/ads.txt` shows the `google.com, pub-…` line and the page source contains `google-adsense-account`.
3. In AdSense, pick the **meta tag** verification method (already on the page) and request review.
4. Privacy & messaging → create the European regulations (GDPR) consent message.
5. After approval: Ads → By ad unit → create a **Display** unit, then set `NEXT_PUBLIC_ADSENSE_SLOT` (or one per
   placement) on Vercel and redeploy.

If you're rejected, the email names the reason. Fix that one thing, wait at least a week, and apply again.

## 5. Growing worldwide traffic, safely

- **Search** is the biggest source. People search "watch {channel} live" and "{country} TV channels online", and our
  page titles are written for exactly that. Search Console → Performance shows which pages are getting impressions.
- **Share channel links** where people already ask for them: Reddit and Facebook groups for expats ("watch Indian
  TV abroad"), Telegram channels, Quora answers. Share a specific channel page, not just the home page, and
  follow each community's rules.
- **Short videos:** a 20-second screen recording ("watch Sun TV free on your phone") on YouTube Shorts, Instagram
  Reels or Moj, with the link in the bio.
- **Timely moments:** cricket matches, elections and festivals send people searching for live news and sports
  channels. Share the right category page that day.

**Never do this, it gets the AdSense account banned for good:** buy traffic, use traffic-exchange or "auto visit"
sites, click your own ads, or ask friends to click them.
