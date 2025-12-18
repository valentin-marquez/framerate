FROM framerate-base:latest AS pruner
WORKDIR /app
COPY . .
RUN bun x turbo prune --scope=collector --docker

FROM framerate-base:latest AS base

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock
RUN bun install --frozen-lockfile --production

FROM base AS runner
WORKDIR /app
COPY --from=installer /app/node_modules ./node_modules
COPY --from=pruner /app/out/full/ .

WORKDIR /app/apps/collector
EXPOSE 3001
CMD ["bun", "src/index.ts"]