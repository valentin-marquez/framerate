FROM oven/bun:1-alpine
WORKDIR /app
COPY src ./src
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["bun", "src/index.ts"]
