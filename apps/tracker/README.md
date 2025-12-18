# Framerate Tracker Service

![ElysiaJS](https://img.shields.io/badge/ElysiaJS-Fast-ff0090?style=flat&logo=elysia)
![Bun](https://img.shields.io/badge/Bun-Runtime-000000?style=flat&logo=bun)

Servicio de alta frecuencia para el monitoreo de precios y stock de componentes de PC.

## Diferencias con el Collector

| Característica | Collector (`apps/collector`) | Tracker (`apps/tracker`) |
|----------------|--------------------------|--------------------------|
| **Objetivo** | Descubrir nuevos productos | Actualizar existentes |
| **Frecuencia** | Baja (Diaria/Semanal) | Alta (Horaria/Minutal) |
| **Complejidad**| Alta (Specs, Imágenes, IA) | Baja (Solo Precio/Stock) |
| **Técnica** | Puppeteer (Navegador completo) | Fetch + HTML Parsing / Puppeteer Optimizado |

## Ejecución en Producción (Coolify)

Este servicio está diseñado para ejecutarse frecuentemente mediante tareas programadas (Scheduled Tasks) en Coolify.

### Healthcheck

Definir un healthcheck para verificar la salud del servicio:

- **Método**: `GET`
- **Esquema**: `http`
- **Host**: `localhost`
- **Puerto**: `3000`
- **Path**: `/health`
- **Código de retorno esperado**: `200`
- **Texto de respuesta esperado**: `OK`
- **Intervalo (s)**: `30`
- **Timeout (s)**: `10`
- **Retries**: `3`
- **Start Period (s)**: `30`

### Actualización de Precios y Stock

Para actualizar todos los productos listados en la base de datos:

```bash
curl -X POST http://localhost:3000/track/batch
```

Este comando procesa **todos** los productos pendientes (ordenados por antigüedad de actualización).

Se recomienda ejecutar este comando cada 30 minutos o 1 hora, dependiendo de la cantidad de productos y recursos del servidor.

## Instalación y Ejecución Local

```bash
# Instalar dependencias
bun install

# Iniciar servidor en desarrollo (con hot-reload)
bun run dev

# Iniciar en producción
bun run start

