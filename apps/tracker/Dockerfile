# STAGE 1: Pruner
FROM oven/bun:1 AS pruner
WORKDIR /app
COPY . .
RUN bun x turbo prune --scope=tracker --docker

# STAGE 2: Base System
FROM oven/bun:1 AS base
WORKDIR /app
ENV NODE_ENV=production

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

WORKDIR /app/apps/tracker
EXPOSE 3000
CMD ["bun", "src/index.ts"]
