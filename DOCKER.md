# Guía de Despliegue con Docker

## Prerrequisitos

1. Docker y Docker Compose instalados
2. Variables de entorno configuradas

## Configuración

1. Copia el archivo de ejemplo de variables de entorno:
```bash
cp .env.example .env
```

2. Edita `.env` y completa con tus valores reales:
    - `SUPABASE_URL`: URL de tu proyecto de Supabase
    - `SUPABASE_SERVICE_ROLE_KEY`: Clave de rol de servicio de Supabase
    - `GROQ_API_KEY`: Clave de API de Groq (si utilizas Groq)
    - `DEEPSEEK_API_KEY`: Clave de API de DeepSeek (si utilizas DeepSeek)
    - `AI_MODE`: Configura como `groq` o `deepseek` (`groq` es para desarrollo, `deepseek` es para producción)

## Construcción y Ejecución

### Construir e iniciar todos los servicios:
```bash
docker-compose up --build
```

### Ejecutar en modo desacoplado:
```bash
docker-compose up -d --build
```

### Ver registros:
```bash
docker-compose logs -f
```

### Detener servicios:
```bash
docker-compose down
```

### Reconstruir un servicio específico:
```bash
docker-compose up --build collector
docker-compose up --build tracker
```

## Servicios

- **Collector**: Funciona en el puerto 3001 - Servicio de recopilación de datos y web scraping
- **Tracker**: Funciona en el puerto 3000 - Servicio de seguimiento de precios

## Resolución de Problemas

### Problema: `bun.lockb` no encontrado

Asegúrate de haber ejecutado `bun install` al menos una vez en la raíz del proyecto para generar el archivo de bloqueo.

### Problema: Falla en Turbo prune

Verifica que los nombres de los espacios de trabajo en tu `package.json` sean correctos. Los alcances deben coincidir:
- `collector` para apps/collector
- `tracker` para apps/tracker

### Problema: Variables de entorno faltantes

Todas las variables de entorno requeridas deben estar configuradas en el archivo `.env`. Revisa el archivo `.env.example` para la lista completa.

### Problema: Error de permisos al construir

Asegúrate de que Docker tenga los permisos necesarios y que el contexto sea correcto.

## Red

Todos los servicios se ejecutan en la red de puente `framerate-network`, lo que les permite comunicarse entre sí.
