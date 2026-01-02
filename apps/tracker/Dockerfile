# syntax=docker/dockerfile:1.4

FROM localhost:5000/framerate-base:latest AS pruner
WORKDIR /app
COPY . .
RUN bun x turbo prune --scope=tracker --docker

FROM localhost:5000/framerate-base:latest AS base

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --production --ignore-scripts

FROM base AS runner
WORKDIR /app
COPY --from=installer /app/node_modules ./node_modules
COPY --from=pruner /app/out/full/ .

WORKDIR /app/apps/tracker
EXPOSE 3000
CMD ["bun", "src/index.ts"]