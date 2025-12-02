FROM oven/bun:1 AS base

WORKDIR /app

# Install system dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package.json bun.lock turbo.json ./
COPY packages/config ./packages/config
COPY packages/db ./packages/db
COPY packages/utils ./packages/utils
COPY apps/scraper ./apps/scraper

RUN bun install --frozen-lockfile

WORKDIR /app/apps/scraper

EXPOSE 3001

CMD ["bun", "run", "start"]
