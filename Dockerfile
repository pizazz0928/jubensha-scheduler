FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV XDG_CONFIG_HOME=/data/config
ENV WRANGLER_LOG_PATH=/data/wrangler.log

EXPOSE 3000

VOLUME ["/data"]

CMD ["sh", "-c", "node node_modules/wrangler/bin/wrangler.js dev --config dist/server/wrangler.json --ip 0.0.0.0 --port ${PORT:-3000} --persist-to /data/wrangler-state --log-level warn --show-interactive-dev-session=false"]
