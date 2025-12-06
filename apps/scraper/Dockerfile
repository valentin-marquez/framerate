# STAGE 1: Pruner
# Usamos turbo para filtrar solo los archivos necesarios para el scraper.
# Esto aísla el scraper de cambios en el frontend.
FROM oven/bun:1 AS pruner
WORKDIR /app
COPY . .
# "scraper" debe coincidir con el nombre en apps/scraper/package.json
RUN bun x turbo prune --scope=scraper --docker

# STAGE 2: Base System (Capa Pesada)
# Instalamos Chromium aquí. Esta capa se cacheará y NO se volverá a ejecutar
# a menos que cambies explícitamente las dependencias del sistema.
FROM oven/bun:1 AS base
WORKDIR /app
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Configuración para que Puppeteer use el Chromium del sistema
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

# STAGE 3: Installer
# Instalamos dependencias de Node/Bun usando los archivos filtrados por pruner.
FROM base AS installer
WORKDIR /app

# Copiamos solo los package.json y lockfiles filtrados
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lockb ./bun.lockb

# Instalamos. Al usar el lockfile filtrado, si cambias algo en "web",
# esta capa NO se rompe y usa el caché. Es mucho más rápido.
RUN bun install --frozen-lockfile --production

# STAGE 4: Runner
# Construimos la imagen final copiando código fuente y modulos instalados.
FROM base AS runner
WORKDIR /app

# Copiamos los node_modules desde el installer
COPY --from=installer /app/node_modules ./node_modules
# Copiamos el código fuente filtrado (incluye apps/scraper y packages/db necesarios)
COPY --from=pruner /app/out/full/ .

WORKDIR /app/apps/scraper

# El usuario root es necesario para ciertas operaciones de Puppeteer en Docker,
# pero si quieres seguridad extra puedes crear un usuario 'bun'.
# Por simplicidad y compatibilidad con Puppeteer sandbox args, lo dejamos así.

EXPOSE 3001

CMD ["bun", "src/index.ts"]