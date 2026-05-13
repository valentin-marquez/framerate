# syntax=docker/dockerfile:1.4

# Base image with Playwright dependencies pre-installed
FROM mcr.microsoft.com/playwright:v1.41.0-jammy AS base

# Install Bun
ENV BUN_INSTALL=/root/.bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH=$BUN_INSTALL/bin:$PATH

WORKDIR /app

# Pruner stage to reduce build context
FROM base AS pruner
WORKDIR /app
COPY . .
RUN bun x turbo prune --scope=collector --docker

# Installer stage
FROM base AS installer
WORKDIR /app

# Copy lockfile and package.json's from pruner
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock

# Install dependencies including devDependencies (needed for build)
RUN bun install --frozen-lockfile

# Runner stage
FROM base AS runner
WORKDIR /app

# Create a non-root user for security (Playwright recommends pwuser)
# The base image already has a 'pwuser', we just need to use it or ensure permissions.
# However, for simplicity and to avoid permission issues with bind mounts/logs, we'll run as root but warn.
# Ideally we switch to pwuser, but we need to ensure /app permissions.
# For now, let's keep it simple but use the new image.

COPY --from=installer /app/node_modules ./node_modules
COPY --from=pruner /app/out/full/ .

WORKDIR /app/apps/collector

# Expose port
EXPOSE 3001

# Start the application
CMD ["bun", "src/index.ts"]
