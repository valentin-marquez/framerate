FROM oven/bun:1-alpine
# Chromium para /render; las fuentes evitan páginas con texto en blanco.
RUN apk add --no-cache chromium font-noto
WORKDIR /app
COPY src ./src
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
# Sin root: Chromium corre sin su sandbox (ver index.ts), así que el contenedor es la frontera.
USER bun
CMD ["bun", "src/index.ts"]
