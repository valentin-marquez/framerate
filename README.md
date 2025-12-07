# Framerate.cl - Arquitectura y Patrones de Diseño

![Bun](https://img.shields.io/badge/Bun-Runtime-000000?style=flat&logo=bun)
![Turborepo](https://img.shields.io/badge/Turborepo-Monorepo-EF2D5E?style=flat&logo=turborepo)
![TypeScript](https://img.shields.io/badge/TypeScript-Language-007ACC?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-Frontend-20232a?style=flat&logo=react&logoColor=61DAFB)
![Hono](https://img.shields.io/badge/Hono-Backend-E05D44?style=flat&logo=hono&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=flat&logo=supabase&logoColor=white)
![Cloudflare](https://img.shields.io/badge/Cloudflare-Deployment-F38020?style=flat&logo=cloudflare&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Containerization-2496ED?style=flat&logo=docker&logoColor=white)
![Biome](https://img.shields.io/badge/Biome-Formatting-60A5FA?style=flat&logo=biome&logoColor=white)

**Sistema de Comparación de Precios para Componentes PC**  
*Documento Técnico - Diciembre 2025*

## 1. Introducción

### 1.1 Visión General
Framerate.cl es una plataforma de comparación de precios especializada en componentes de PC para el mercado chileno. El sistema está diseñado con una arquitectura modular que separa claramente las responsabilidades entre scraping, almacenamiento y presentación de datos, garantizando escalabilidad, mantenibilidad y seguridad.

### 1.2 Principios Arquitectónicos
*   **Separación de Responsabilidades:** Cada componente tiene un propósito único y bien definido.
*   **Aislamiento del Scraping:** Los crawlers operan completamente aislados del usuario final.
*   **Única Fuente de Verdad:** Supabase PostgreSQL como base de datos centralizada.
*   **Edge-First:** Distribución global mediante Cloudflare para latencia mínima.
*   **Monorepo Compartido:** Código, tipos y lógica compartida en un único repositorio.

## 2. Arquitectura de Capas

### 2.1 Capa de Presentación (apps/web)
El frontend es una aplicación moderna construida con **React Router v7** (anteriormente Remix). Utiliza **Server-Side Rendering (SSR)** con **Tailwind CSS v4** y **Vite** como bundler. Aunque utiliza renderizado en el servidor, mantiene la separación de responsabilidades consumiendo la API pública.

> **Patrón:** El frontend (incluso en el lado del servidor) nunca accede directamente a la base de datos. Toda comunicación pasa por la API Gateway implementada en Workers, garantizando seguridad y control de acceso centralizado.

### 2.2 Capa de API (apps/api)
Los Cloudflare Workers funcionan como API Gateway. Implementados con **Hono framework**, proporcionan endpoints RESTful con rate limiting y validación de requests. Esta capa tiene acceso de solo lectura a Supabase utilizando la anon key con Row Level Security.

**Endpoints Implementados:**
- `GET /v1/products` - Listado con filtros (categoría, marca, precio, specs)
- `GET /v1/products/:slug` - Detalle de producto con listings y variantes
- `GET /v1/products/search` - Búsqueda por término
- `GET /v1/categories` - Listado de categorías
- `GET /v1/images/:path` - Proxy de imágenes con cache

**Middleware Activo:**
- Rate limiting por IP (100 req/15min)
- Cache API para respuestas (listados: 5min, detalles: 1hr)
- CORS restringido a dominios permitidos
- Security headers

### 2.3 Capa de Datos (Supabase)
Supabase PostgreSQL funciona como única fuente de verdad. Almacena productos canónicos, listings de tiendas, histórico de precios y metadatos. La seguridad se implementa mediante Row Level Security policies que permiten lectura pública pero escritura restringida únicamente al scraper mediante service role key.

### 2.4 Capa de Scraping (apps/scraper)
El sistema de scraping opera completamente aislado y está diseñado para ser deployable utilizando Docker, a diferencia del resto de las aplicaciones. Esto permite ejecutar el scraper en entornos controlados y reproducibles, independientemente de la infraestructura subyacente. 

No expone APIs públicas ni acepta conexiones entrantes. Su única función es extraer datos de tiendas, procesarlos y escribirlos a Supabase. Esta separación garantiza que problemas en los crawlers nunca afecten la experiencia del usuario final. Además, el uso de Docker facilita la escalabilidad horizontal y el despliegue en servidores dedicados o entornos locales.

## 3. Patrones de Diseño para Scraping

### 3.1 Patrón: Base Crawler Abstracto
Todos los crawlers heredan de una clase base abstracta (`BaseCrawler`) que define el contrato y comportamiento común. Esto garantiza consistencia y facilita la adición de nuevas tiendas sin duplicar lógica.

**Responsabilidades del BaseCrawler:**
*   Rate limiting configurable por tienda (`requestDelay`)
*   Pool de páginas Puppeteer para concurrencia controlada
*   Logging estructurado de operaciones
*   Fetch con headers realistas (User-Agent, Sec-Ch-Ua, etc.)
*   Bloqueo de recursos innecesarios (imágenes, fonts, CSS) para velocidad
*   Procesamiento por lotes (`fetchHtmlBatch`)

**Pendiente de implementar:**
*   Respeto por robots.txt
*   Backoff exponencial en errores HTTP
*   User-Agent rotation (actualmente 1 UA fijo)
*   Proxy management

### 3.2 Patrón: Strategy para Selectores
Cada tienda tiene su propia estrategia de extracción implementada como un conjunto de selectores y transformadores. Cuando una tienda cambia su HTML, solo se actualiza su estrategia específica sin afectar otros crawlers.

**Crawlers Implementados:**
- `PcExpressCrawler`: Usa HTMLRewriter de Bun para parsing rápido sin JS
- `SpDigitalCrawler`: Usa Puppeteer (headless) + meta tags estructurados

**Categorías Soportadas (10):** GPU, CPU, PSU, Motherboard, Case, RAM, HDD, SSD, Case Fan, CPU Cooler

**Pendiente:** Versionado de selectores y fallback automático

### 3.3 Procesamiento Concurrente
El scraping utiliza **Bun Workers** para procesamiento en paralelo y **Kuron** para scheduling de tareas programadas (cron cada 4 horas).

**Arquitectura Actual:**
- Workers procesan productos en lotes de 4 (`BATCH_SIZE`)
- Pool de páginas Puppeteer con concurrencia configurable (3-4 páginas)
- Procesamiento síncrono por categoría con paralelización interna

> **Nota:** El sistema actual no usa colas distribuidas (BullMQ). Los jobs se procesan directamente en el worker que los inicia. Para escalar horizontalmente, se planea migrar a un sistema de colas real.

### 3.4 Matching de Productos
El matching de productos entre tiendas utiliza actualmente el **MPN (Manufacturer Part Number)** como identificador único.

**Algoritmo de Matching:**
1.  Extraer MPN del título, metadatos o meta tags del producto
2.  Buscar en base de datos por MPN exacto (`findExistingProduct`)
3.  Si existe, actualizar specs y crear/actualizar listing
4.  Si no existe, crear nuevo producto canónico

**Pendiente de implementar:**
- Fingerprinting de especificaciones normalizadas
- Score de confianza por método de match
- Cola de revisión manual para matches dudosos
- Agrupación automática de variantes (`product_groups`)

> **Nota:** El campo EAN fue removido del schema. El matching se basa exclusivamente en MPN.

### 3.5 Patrón: Normalización de Datos
Los datos scrapeados pasan por un pipeline de normalización extensivo antes de almacenarse.

**Pipeline Implementado:**
1. **Normalización de títulos** (`normalizers/`): Limpieza y estandarización por categoría
2. **Extracción de specs** (`processors/`): Regex + mapeo de claves a formato canónico
3. **Extracción IA** (`processors/ai/`): LLM (Groq/DeepSeek) para specs complejas con cache en BD
4. **Validación de productos**: Filtros por términos excluidos ("caja abierta", "usado", etc.)
5. **Procesamiento de imágenes**: Compresión con Sharp, upload a Supabase Storage

**Normalizadores por Categoría:** GPU, CPU, PSU, Motherboard, Case, RAM, HDD, SSD, Case Fan, CPU Cooler

> **Cache de IA:** Las extracciones de specs por IA se cachean en `cached_specs_extractions` usando MPN como clave.

### 3.6 Patrón: Incremental Updates
El scraper no reescribe toda la base de datos en cada ejecución.

**Implementado:**
- Upsert de listings por `(store_id, external_id)` - solo actualiza si cambió
- `last_scraped_at` se actualiza en cada scrape
- Histórico de precios en tabla `price_history` (registro por cada scrape)
- Cache de marcas en memoria para evitar race conditions

**Pendiente:**
- Comparación de hashes para detectar cambios reales (evitar writes innecesarios)
- Detección de productos descontinuados

## 4. Estrategias de Modularidad

### 4.1 Shared Types Package
Todos los tipos TypeScript se definen en `packages/db` y se importan en todas las apps. Esto garantiza que frontend, API y scraper hablen el mismo lenguaje.

**Estructura de packages/db:**
- `types.ts`: Tipos autogenerados de Supabase (`Database`, `Tables`, `TablesInsert`)
- `specs.ts`: Interfaces de especificaciones por categoría (`GpuSpecs`, `CpuSpecs`, etc.)
- `storage.ts`: Utilidades para Supabase Storage (buckets, URLs, validación)

### 4.2 Crawlers como Módulos
Cada tienda es una clase independiente que extiende `BaseCrawler`. Agregar una nueva tienda consiste en:
1. Crear archivo en `crawlers/` implementando `parseProduct` y `getProductUrls`
2. Definir mapeo de categorías a URLs
3. Registrar en el worker (`scraper.worker.ts`)

**Tiendas Implementadas:** PC Express, SP Digital

### 4.3 Configuration as Code
Toda configuración vive en código TypeScript con tipos estrictos. No hay archivos JSON o YAML que puedan corromperse. Las configuraciones de tiendas incluyen URLs base, selectores, rate limits, y headers HTTP. Los cambios se versionan en Git y se despliegan atómicamente.

### 4.4 Domain-Driven Design
El código está organizado por dominios de negocio, no por capas técnicas. Existe un dominio Product, uno Listing, uno Store, etc. Cada dominio tiene sus entidades, repositorios, servicios y validadores. Esto facilita el razonamiento sobre el código y previene acoplamiento excesivo.

## 5. Resiliencia y Manejo de Errores

### 5.1 Graceful Degradation
Si algunos campos no se pueden extraer (por ejemplo, el MPN no está presente), el scraper continúa con los datos disponibles. Los productos sin MPN se crean igualmente. La extracción IA tiene fallback a procesadores regex si falla.

### 5.2 Manejo de Race Conditions
- Cache en memoria de marcas (`brandCache`) con deduplicación de promesas
- Manejo de errores de clave duplicada (código 23505) con retry
- Upsert atómico de listings por constraint único

### 5.3 Rate Limiting de IA
- `RateLimiter` class para Groq API (10 RPM)
- Retry automático en errores 429 con delay de 5s

### 5.4 Pendiente de Implementar
- **Circuit Breaker:** Marcar tiendas como unavailable temporalmente después de N fallos
- **Dead Letter Queue:** Cola de jobs fallidos para análisis
- **Métricas estructuradas:** Dashboards de salud por tienda
- **Alertas automáticas:** Notificaciones cuando selectores dejan de funcionar

## 6. Optimización de Performance

### 6.1 Caching en API
Los Workers cachean respuestas usando la **Cache API** de Cloudflare (no KV):
- Listados de productos: 5 minutos (`max-age=300`)
- Detalles de producto: 1 hora (`max-age=3600`)
- Imágenes proxy: 1 año (`max-age=31536000, immutable`)

> **Nota:** En desarrollo local (Bun), el cache se desactiva automáticamente ya que la Cache API no está disponible.

### 6.2 Batch Processing
El scraper procesa en lotes de 4 productos simultáneos (`BATCH_SIZE = 4`). Cada lote:
- Obtiene HTML en paralelo
- Parsea productos concurrentemente
- Escribe a BD (no en batch SQL, pero reduce round-trips de fetch)

### 6.3 Indexación en Base de Datos
Migraciones de índices optimizados:
- `20251125064000_add_indexes_for_foreign_keys.sql`
- `20251125063000_fix_rls_performance.sql`
- Función `filter_products` con filtros eficientes

### 6.4 Procesamiento de Imágenes
- Imágenes descargadas y comprimidas con **Sharp**
- Conversión automática a WebP
- Resize progresivo si excede límite de tamaño
- Upload a Supabase Storage con deduplicación por MPN

## 7. Consideraciones de Seguridad

### 7.1 Separación de Credenciales
| Capa | Key | Permisos |
|------|-----|----------|
| Scraper | `SUPABASE_SERVICE_ROLE_KEY` | Lectura/Escritura completa |
| API | `SUPABASE_PUBLISHABLE_KEY` | Solo lectura (RLS) |
| Frontend | Ninguna | Sin acceso directo a BD |

### 7.2 Rate Limiting en API
- 100 requests por IP cada 15 minutos
- Usa header `CF-Connecting-IP` para identificar clientes
- Respuesta 429 con mensaje descriptivo

### 7.3 Row Level Security
Todas las tablas tienen RLS habilitado:
- Lectura pública para productos, listings, categorías, tiendas
- Escritura restringida a service role
- Usuarios autenticados pueden gestionar sus quotes y alertas

### 7.4 Headers de Seguridad
- `secureHeaders()` middleware de Hono
- CORS restringido a `framerate.cl` y `localhost:3000`

### 7.5 Pendiente
- Sanitización explícita de HTML scrapeado (actualmente implícita en el parsing)

## 8. Plan de Escalabilidad

### 8.1 Arquitectura Actual
- **Scraper:** Bun Workers con procesamiento síncrono por categoría
- **API:** Cloudflare Workers (serverless, escala automáticamente)
- **BD:** Supabase PostgreSQL (plan gratuito actualmente)

### 8.2 Opciones de Escalado Horizontal
1. **Múltiples instancias de scraper** con particionamiento por tienda
2. **Migración a colas reales** (BullMQ + Redis) para distribución de jobs
3. **Read replicas** de Supabase para separar tráfico de lectura

### 8.3 Optimizaciones Futuras
- Cloudflare R2 para imágenes (en lugar de Supabase Storage)
- Cloudflare KV para cache distribuido
- Workers KV para rate limiting distribuido

## 9. Mantenibilidad a Largo Plazo

### 9.1 Testing
**Tests existentes en `apps/scraper/tests/`:**
- `gpu-normalization.test.ts` - Normalización de títulos de GPUs
- `psu-normalization.test.ts` - Normalización de PSUs
- `motherboard-normalization.test.ts` - Normalización de motherboards
- `cpu-cooler-normalization.test.ts` - Normalización de coolers
- `case-normalization.test.ts` - Normalización de gabinetes
- `ia-extraction.test.ts` - Extracción con IA
- `psu-ia-extraction.test.ts` - Extracción IA de PSUs

**Pendiente:**
- Fixtures de HTML para tests de crawlers
- Integration tests end-to-end
- Tests de API endpoints

### 9.2 Migraciones Versionadas
Más de 30 migraciones SQL en `packages/db/supabase/migrations/`. Cada cambio al schema es versionado y reproducible.

### 9.3 Documentación
- README en cada package/app
- Tipos TypeScript como documentación
- Comentarios en normalizadores explicando lógica

---

> **Nota:** Este documento refleja el estado real de implementación a Diciembre 2025. La arquitectura está diseñada para ser implementada incrementalmente.