FROM oven/bun:1 AS base

WORKDIR /app

RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

FROM base AS deps

WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY packages/config/package.json ./packages/config/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/utils/package.json ./packages/utils/package.json
COPY apps/scraper/package.json ./apps/scraper/package.json

RUN bun install --frozen-lockfile --production

FROM base AS runner

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY packages/config ./packages/config
COPY packages/db ./packages/db
COPY packages/utils ./packages/utils
COPY apps/scraper ./apps/scraper

WORKDIR /app/apps/scraper

EXPOSE 3001

CMD ["bun", "src/index.ts"]
