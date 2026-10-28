# Build from the repo root:  docker build -f apps/worker/Dockerfile .
FROM node:24-slim AS build
RUN npm install -g pnpm@12.15.0
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter tunely --filter "@tunely/worker..."
RUN pnpm --filter @tunely/worker build

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
RUN pnpm install --frozen-lockfile --prod --filter "@tunely/worker" && pnpm store prune
COPY --from=build /repo/apps/worker/dist apps/worker/dist
USER node
CMD ["node", "--enable-source-maps", "apps/worker/dist/index.js"]
