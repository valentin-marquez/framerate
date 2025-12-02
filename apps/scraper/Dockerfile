FROM oven/bun:1 AS base

WORKDIR /app

# Install system dependencies for Puppeteer
# Puppeteer needs these to run Chromium in headless mode
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables for Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Copy root configuration files
COPY package.json bun.lockb turbo.json ./

# Copy shared packages
COPY packages/config ./packages/config
COPY packages/db ./packages/db
COPY packages/utils ./packages/utils

# Copy the scraper application
COPY apps/scraper ./apps/scraper

# Install dependencies
# This will install dependencies for the root, shared packages, and scraper app
# It ignores other apps (api, web) because their folders are not present
RUN bun install --frozen-lockfile

# Set working directory to the scraper app
WORKDIR /app/apps/scraper

# Expose the port
EXPOSE 3001

# Start the scraper
CMD ["bun", "run", "start"]
