# API + worker in one container, for Render's free plan. Build from the repo root:
#   docker build -f deploy/render/Dockerfile .
FROM node:24-slim AS build
RUN npm install -g pnpm@12.15.0
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter tunely --filter "@tunely/api..." --filter "@tunely/worker..."
RUN pnpm --filter @tunely/api --filter @tunely/worker build

FROM node:24-slim
ENV NODE_ENV=production
# Render free instances have 512 MB; a capped heap makes V8 collect harder so the daily catalog sync fits.
ENV NODE_OPTIONS=--max-old-space-size=320
RUN npm install -g pnpm@12.15.0
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/config/package.json packages/config/
RUN pnpm install --frozen-lockfile --prod --filter "@tunely/api" --filter "@tunely/worker" && pnpm store prune
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/worker/dist apps/worker/dist
COPY packages/db/migrations packages/db/migrations
COPY deploy/render/start.mjs deploy/render/start.mjs
USER node
EXPOSE 4000
CMD ["node", "--enable-source-maps", "deploy/render/start.mjs"]
