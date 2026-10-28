#!/usr/bin/env sh
# Pull the latest code and rebuild/restart whatever changed. Run on the server from the repo root:
#   sh deploy/update.sh
set -e
git pull --ff-only
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
docker image prune -f
