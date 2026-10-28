# Build from the repo root:  docker build -f apps/api/Dockerfile .
FROM node:24-slim AS build
RUN npm install -g pnpm@12.15.0
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter tunely --filter "@tunely/api..."
RUN pnpm --filter @tunely/api build

FROM node:24-slim
ENV NODE_ENV=production
RUN npm install -g pnpm@12.15.0
WORKDIR /repo
# Every workspace manifest, so the lockfile matches; only this app's production deps get installed.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/config/package.json packages/config/
RUN pnpm install --frozen-lockfile --prod --filter "@tunely/api" && pnpm store prune
COPY --from=build /repo/apps/api/dist apps/api/dist
# Migrations ship with the API image; Railway runs dist/migrate.js before each deploy goes live.
COPY packages/db/migrations packages/db/migrations
USER node
EXPOSE 4000
CMD ["node", "--enable-source-maps", "apps/api/dist/index.js"]
