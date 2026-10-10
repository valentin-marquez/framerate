# Versión fija: /render usa Bun.WebView, que es experimental y puede cambiar entre versiones.
FROM oven/bun:1.4.3-alpine
# Chromium para /render (sin fuentes: se bloquean y el DOM no las necesita).
RUN apk add --no-cache chromium
WORKDIR /app
COPY src ./src
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
# Sin root: Chromium corre sin su sandbox (ver `webview` en index.ts), así que el contenedor es la frontera.
USER bun
CMD ["bun", "src/index.ts"]
