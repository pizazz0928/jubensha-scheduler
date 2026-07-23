FROM node:22.21.1-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

RUN mkdir -p /data/wrangler-state /tmp/wrangler-config \
    && chown -R node:node /app /data /tmp/wrangler-config

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
