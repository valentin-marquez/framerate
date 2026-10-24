FROM oven/bun:1.4.3-alpine
WORKDIR /app
# Sólo sharp: el package.json del monorepo trae dependencias `workspace:*` que fuera del repo no se resuelven.
# Misma versión que apps/resizer/package.json.
RUN bun add sharp@0.35.5
COPY src/index.ts ./src/index.ts
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
USER bun
CMD ["bun", "src/index.ts"]
