# Build from the repo root:  docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_SITE_URL=https://example.com .
FROM node:24-slim AS build
RUN npm install -g pnpm@12.15.0
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter tunely --filter "@tunely/web..."
# NEXT_PUBLIC_* values are baked into the browser bundle at build time.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_ADSENSE_CLIENT=
ARG NEXT_PUBLIC_ADSENSE_SLOT=
ARG NEXT_PUBLIC_ADSENSE_SLOT_HOME=
ARG NEXT_PUBLIC_ADSENSE_SLOT_BROWSE=
ARG NEXT_PUBLIC_ADSENSE_SLOT_WATCH=
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_ADSENSE_CLIENT=$NEXT_PUBLIC_ADSENSE_CLIENT \
    NEXT_PUBLIC_ADSENSE_SLOT=$NEXT_PUBLIC_ADSENSE_SLOT \
    NEXT_PUBLIC_ADSENSE_SLOT_HOME=$NEXT_PUBLIC_ADSENSE_SLOT_HOME \
    NEXT_PUBLIC_ADSENSE_SLOT_BROWSE=$NEXT_PUBLIC_ADSENSE_SLOT_BROWSE \
    NEXT_PUBLIC_ADSENSE_SLOT_WATCH=$NEXT_PUBLIC_ADSENSE_SLOT_WATCH \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @tunely/web build

FROM node:24-slim
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
# The standalone server writes its page cache under .next, so the files belong to the runtime user.
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
