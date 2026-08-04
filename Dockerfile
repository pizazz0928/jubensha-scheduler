FROM node:22.21.1-bookworm-slim AS build

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable \
    && corepack prepare pnpm@11.9.0 --activate \
    && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:22.21.1-bookworm-slim AS production-dependencies

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable \
    && corepack prepare pnpm@11.9.0 --activate \
    && pnpm install --prod --frozen-lockfile \
    && pnpm store prune

FROM node:22.21.1-bookworm-slim AS runtime

WORKDIR /app

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/package.json ./package.json

RUN mkdir -p /data/wrangler-state /tmp/wrangler-config \
    && chown -R node:node /data /tmp/wrangler-config

ENV NODE_ENV=production
ENV PORT=3000
ENV XDG_CONFIG_HOME=/tmp/wrangler-config
ENV WRANGLER_LOG_PATH=/tmp/wrangler.log
ENV LOCAL_D1_DIR=/data/wrangler-state
ENV LOCAL_STORE_PATH=/data/scheduler-state.json
ENV WRANGLER_SEND_METRICS=false

EXPOSE 3000

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "scripts/start-cloud-run.mjs"]
