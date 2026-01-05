# syntax=docker/dockerfile:1.4

FROM localhost:5000/framerate-base:latest AS pruner
WORKDIR /app
COPY . .
RUN bun x turbo prune --scope=cortex --docker

FROM localhost:5000/framerate-base:latest AS base

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production --ignore-scripts

FROM base AS runner
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=installer /app/node_modules ./node_modules
COPY --from=pruner /app/out/full/ .

WORKDIR /app/apps/cortex

CMD ["bun", "src/index.ts"]