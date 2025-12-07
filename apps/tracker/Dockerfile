FROM oven/bun:1 AS pruner
WORKDIR /app
COPY . .
RUN bun x turbo prune --scope=tracker --docker

FROM oven/bun:1 AS base
USER root
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    chromium \
    curl \
    wget \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock
RUN bun install --frozen-lockfile --production

FROM base AS runner
WORKDIR /app
COPY --from=installer /app/node_modules ./node_modules
COPY --from=pruner /app/out/full/ .

WORKDIR /app/apps/tracker
EXPOSE 3000
CMD ["bun", "src/index.ts"]
