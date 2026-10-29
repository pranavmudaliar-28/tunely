# Earning from Tunely: setup steps

Everything is built and switched off. You sign up (free) and paste the ids into Vercel → tunely-tv → Settings →
Environment Variables, then redeploy (Deployments → ⋯ → Redeploy on the latest one). Nothing shows until its
variable is set, and removing a variable switches that feature off again.

## 1. Adsterra banners (start earning now)

1. Sign up as a **Publisher** at <https://adsterra.com>, then add your website (`https://tunely-tv.vercel.app`).
2. Once the site is approved (usually within a day), go to **Websites → Add code → Banner**:
   - create a **728×90** banner (desktop) and a **320×50** banner (phones);
   - from each code snippet, copy the `'key'` value (a long string of letters and numbers).
3. In Vercel, set:
   - `NEXT_PUBLIC_ADSTERRA_KEY_728X90` = the 728×90 key
   - `NEXT_PUBLIC_ADSTERRA_KEY_320X50` = the 320×50 key
   - `NEXT_PUBLIC_ADSTERRA_SCRIPT` = the snippet's `<script src="…">` address with the key replaced by `{key}`,
     e.g. `https://bauval.org/22/{key}`
4. Redeploy. Banners appear in the existing ad spots: the home page between rails, under browse grids, and
   below the title on watch pages of live channels. They never appear on the video.

**Only create Banner units.** Don't add Popunder, Social Bar or Direct Link codes: they annoy viewers, cost you
visitors, and get the site flagged by browsers. Ask Adsterra support to block gambling/betting ads for your site: real-money betting ads are restricted in India.

If AdSense approves the site later, set `NEXT_PUBLIC_ADSENSE_CLIENT` and a slot id. AdSense then replaces
Adsterra automatically.

Payouts: minimum $5 (Paxum, WebMoney) or $100 (bank wire), paid every 2 weeks.

## 2. Support / donation button

1. Create a page on <https://buymeacoffee.com> or <https://ko-fi.com> (both accept Indian payouts), or a
   Razorpay payment page.
2. Set `NEXT_PUBLIC_SUPPORT_URL` = the page link (must start with `https://`).
3. Redeploy. A "♥ Support Tunely" link appears in the footer and on the About page.

## 3. Amazon affiliate links (on the "Watch on TV" page)

1. Join Amazon Associates for your store (India: <https://affiliate-program.amazon.in>). You'll get a tracking
   id like `yourname-21`.
2. Set `NEXT_PUBLIC_AMAZON_TAG` = that id. For a store other than amazon.in, also set `NEXT_PUBLIC_AMAZON_DOMAIN`
   (e.g. `amazon.com`).
3. Redeploy. `/watch-on-tv` then shows Fire TV Stick, Chromecast and Android TV box links, with the required
   disclosure.

Amazon closes accounts with no sales in the first 180 days, so join once you have some traffic.

## 4. VPN affiliate (optional)

1. Join a VPN affiliate programme (NordVPN, Surfshark and ExpressVPN run theirs through Impact or CJ) and copy
   your affiliate link.
2. Set `NEXT_PUBLIC_VPN_AFFILIATE_URL` = the link and `NEXT_PUBLIC_VPN_NAME` = the brand (e.g. `NordVPN`).
3. Redeploy. A short "Stay private on public Wi-Fi" note appears on `/watch-on-tv`.

It's framed around privacy on purpose. Don't advertise VPNs as a way to get around broadcasters' region blocks:
that invites copyright complaints and gets ad accounts rejected.

## Taxes

Earnings from ads and affiliates are income. In India, payouts from Adsterra and Amazon count toward your
income tax return; keep the payout statements.
