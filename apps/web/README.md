# Framerate Web Client

![React Router](https://img.shields.io/badge/React_Router-v7-CA4245?style=flat&logo=reactrouter&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=flat&logo=tailwind-css&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-Runtime-000000?style=flat&logo=bun)
![Cloudflare](https://img.shields.io/badge/Cloudflare-Pages-F38020?style=flat&logo=cloudflare&logoColor=white)

Frontend principal de Framerate.cl. Una aplicación moderna `SSR` (Server-Side Rendering) distribuida globalmente en el Edge.

## Arquitectura

- **Framework**: React Router v7 (anteriormente Remix).
- **Styling**: Tailwind CSS v4.
- **Rendering**: SSR en Cloudflare Pages.
- **Seguridad**:
  - NO conecta directamente a la base de datos (Postgres).
  - Consume datos exclusivamente a través de la API Gateway (`apps/api`).
  - Utiliza `VITE_SUPABASE_ANON_KEY` solo para auth client-side limitado si es necesario.

## Variables de Entorno

Crear un archivo `.env` basado en `.env.example`:

```bash
VITE_API_URL=http://127.0.0.1:8787   # URL local del Worker API (o producción)
VITE_SUPABASE_URL=...                # URL de proyecto Supabase
VITE_SUPABASE_ANON_KEY=...           # Key pública (anon)
```

## Desarrollo Local

Este proyecto utiliza **Bun** como runtime y gestor de paquetes.

```bash
# Instalación de dependencias
bun install

# Iniciar servidor de desarrollo
bun run dev
```

La aplicación estará disponible en `http://localhost:5173`.

## Compilación y Despliegue

El despliegue se realiza en **Cloudflare Pages**.

```bash
# Construir para producción
bun run build

# Desplegar (requiere login en Cloudflare)
# Nota: Las variables de entorno de producción se gestionan en el Dashboard de Cloudflare
bun run deploy
```

## Estructura del Proyecto

- `app/routes/`: Rutas de la aplicación (File-based routing).
- `app/components/`: Componentes UI reutilizables (shadcn/ui, primitivos).
- `app/lib/`: Utilidades base (API client, configuración).
- `app/services/`: Lógica de negocio lado servidor (loaders, actions).
- `workers/`: Entry point para Cloudflare Workers.

