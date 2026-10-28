# Deploying Tunely for free (always on)

Everything runs on one **Oracle Cloud "Always Free"** server with Docker Compose: website, API, worker,
Postgres, Redis, nightly database backups and automatic HTTPS (Caddy). Free with no time limit and no sleeping.
Video never passes through the server, so its bandwidth use stays small.

```
Browser ──► https://your-domain ──► Caddy ──┬─► web (Next.js)
                                            └─► /v1/* ─► api ──► Postgres, Redis ◄── worker
```

Total cost: **$0**. You need a debit/credit card for Oracle's identity check (a small hold is refunded).
Check Oracle's current Always Free terms before signing up; they can change.

## 1. Create the free server (Oracle Cloud)

1. Sign up at **oracle.com/cloud/free**. Pick a home region close to your viewers (Mumbai or Hyderabad for
   India). The home region can't be changed later, and Always Free servers must be created there.
2. Console → **Compute → Instances → Create instance**:
   - **Image:** Canonical Ubuntu 24.04.
   - **Shape:** Change shape → Ampere → **VM.Standard.A1.Flex**, **2 OCPU, 12 GB RAM** (Always Free covers up to 4 OCPU / 24 GB in total).
   - **Networking:** keep "Assign a public IPv4 address" on.
   - **SSH keys:** "Generate a key pair for me" → download the private key.
   - Create. If you get "Out of capacity", try again later or pick another availability domain.
3. Note the instance's **Public IP**.
4. **Open ports 80 and 443:** Instance → Subnet → Security List → **Add Ingress Rules**:
   source `0.0.0.0/0`, TCP, destination ports `80,443`.

Avoid the idle reclaim: Oracle may reclaim Always Free servers that sit nearly idle for a week. Tunely's
stream checker keeps it busy, but to be safe upgrade the account to **Pay As You Go** (Billing → Upgrade).
Always Free resources stay free; you are only charged if you create paid ones.

## 2. Get a free domain (DuckDNS)

1. Go to **duckdns.org**, sign in, create a subdomain (e.g. `tunely-tv` → `tunely-tv.duckdns.org`).
2. Put the server's public IP in its **current ip** box and click **update ip**.

DuckDNS is fine to launch with. **AdSense will not approve a DuckDNS address**: for ads you need your own
domain (~$10/year at Cloudflare). Switching later is just DNS plus one line in `deploy/.env`.

## 3. Set up the server

Connect (Windows PowerShell, macOS or Linux):

```sh
ssh -i path/to/ssh-key.key ubuntu@YOUR_SERVER_IP
```

Then on the server:

```sh
# Oracle's Ubuntu images block ports 80/443 in the local firewall too: open them.
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo apt-get update && sudo apt-get install -y iptables-persistent && sudo netfilter-persistent save

# Docker (starts automatically on boot)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu && newgrp docker

# A swap file gives the Next.js build some headroom
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 4. Get the code onto the server

The repository is private, so give the server read access:

1. On the server: `ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519 && cat ~/.ssh/id_ed25519.pub`
2. GitHub → your `tunely` repo → Settings → **Deploy keys** → Add → paste it (read-only).
3. Clone:

```sh
git clone git@github.com:pranavmudaliar-28/tunely.git && cd tunely
```

## 5. Configure and start

```sh
cp deploy/.env.example deploy/.env
nano deploy/.env
```

Set `DOMAIN` to your DuckDNS name, and fill `POSTGRES_PASSWORD`, `ADMIN_TOKEN` and `REPORT_HASH_SECRET`
with three different values from `openssl rand -hex 32`. Then:

```sh
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

The first build takes about 10–15 minutes on the free server. Then:

- Caddy gets an HTTPS certificate on its own (needs ports 80/443 open and DuckDNS pointing at the server).
- Migrations run, and the worker imports the channel catalog within a minute or two.
- Streams are health-checked 1,000 every 15 minutes, so channels light up as **Live** over the first ~4 hours.

Check it:

```sh
docker compose -f deploy/docker-compose.yml --env-file deploy/.env ps     # everything "Up"
curl https://YOUR_DOMAIN/v1/health                                        # {"status":"ok"}
```

Then open `https://YOUR_DOMAIN` in a browser.

## Everyday tasks

All from the `tunely` folder on the server. `C` below stands for
`docker compose -f deploy/docker-compose.yml --env-file deploy/.env`.

| Task                               | Command                                                                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Deploy the latest code from GitHub | `sh deploy/update.sh`                                                                                                                                              |
| See logs                           | `C logs -f --tail 100 api` (or `worker`, `web`, `caddy`)                                                                                                           |
| Restart everything                 | `C restart`                                                                                                                                                        |
| Sync the catalog now               | `curl -X POST -H "Authorization: Bearer YOUR_ADMIN_TOKEN" https://YOUR_DOMAIN/v1/admin/sync`                                                                       |
| Hide a channel (takedown)          | `C exec postgres psql -U tunely -c "update channel_curation set status='removed', reason='takedown' where channel_id='Foo.us'; select refresh_public_channels();"` |
| List backups                       | `C exec backup ls -lh /backups`                                                                                                                                    |
| Copy a backup to your PC           | `docker cp tunely-prod-backup-1:/backups/tunely-YYYY-MM-DD.dump .` then `scp` it down                                                                              |

Everything restarts by itself after a crash or a server reboot.

## Switching to your own domain later (for AdSense)

1. Buy a domain (Cloudflare Registrar is at-cost). Add an **A record** pointing to the server IP,
   **Proxy status: DNS only**.
2. Change `DOMAIN=` in `deploy/.env`, add `NEXT_PUBLIC_ADSENSE_CLIENT` / `NEXT_PUBLIC_ADSENSE_SLOT` once
   AdSense approves the site, and run `sh deploy/update.sh` (the website rebuilds with the new address).

## Before announcing the site publicly

Still to do (Phase 6): privacy policy, terms and takedown pages (AdSense requires a privacy policy),
security headers, error tracking, uptime monitoring (UptimeRobot's free plan can ping `/v1/health`), and
copying backups off the server.
