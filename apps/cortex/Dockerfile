FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .

ENV NODE_ENV=production

CMD ["bun", "src/index.ts"]
