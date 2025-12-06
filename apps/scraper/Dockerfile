# STAGE 1: Pruner
FROM oven/bun:1 AS pruner
WORKDIR /app
COPY . .
RUN bun x turbo prune --scope=scraper --docker

# STAGE 2: Base System
FROM oven/bun:1 AS base
WORKDIR /app
RUN apt-get update && apt-get install -y \
    chromium \
    curl \
    wget \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

# STAGE 3: Installer
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock
RUN bun install --frozen-lockfile --production

# STAGE 4: Runner
FROM base AS runner
WORKDIR /app
COPY --from=installer /app/node_modules ./node_modules
COPY --from=pruner /app/out/full/ .

WORKDIR /app/apps/scraper
EXPOSE 3001
CMD ["bun", "src/index.ts"]