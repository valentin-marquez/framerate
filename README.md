# Framerate.cl - Arquitectura y Patrones de Diseño

![Bun](https://img.shields.io/badge/Bun-000000?style=flat-square&logo=bun&logoColor=white)
![Turborepo](https://img.shields.io/badge/Turborepo-EF2D5E?style=flat-square&logo=turborepo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232a?style=flat-square&logo=react&logoColor=61DAFB)
![Hono](https://img.shields.io/badge/Hono-E05D44?style=flat-square&logo=hono&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Cloudflare](https://img.shields.io/badge/Cloudflare-F38020?style=flat-square&logo=cloudflare&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![Biome](https://img.shields.io/badge/Biome-60A5FA?style=flat-square&logo=biome&logoColor=white)

**Sistema de Comparación de Precios para Componentes PC**  
*Documento Técnico - Noviembre 2025*

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
El frontend es una aplicación moderna construida con **React Router v7** (anteriormente Remix). Utiliza **Server-Side Rendering (SSR)** desplegado en Cloudflare Pages para optimizar SEO, performance y experiencia de usuario. Aunque utiliza renderizado en el servidor, mantiene la separación de responsabilidades consumiendo la API pública.

> **Patrón:** El frontend (incluso en el lado del servidor) nunca accede directamente a la base de datos. Toda comunicación pasa por la API Gateway implementada en Workers, garantizando seguridad y control de acceso centralizado.

### 2.2 Capa de API (apps/api)
Los Cloudflare Workers funcionan como API Gateway. Implementados con Hono framework, proporcionan endpoints RESTful con rate limiting y validación de requests. Esta capa tiene acceso de solo lectura a Supabase utilizando la anon key con Row Level Security.

### 2.3 Capa de Datos (Supabase)
Supabase PostgreSQL funciona como única fuente de verdad. Almacena productos canónicos, listings de tiendas, histórico de precios y metadatos. La seguridad se implementa mediante Row Level Security policies que permiten lectura pública pero escritura restringida únicamente al scraper mediante service role key.

### 2.4 Capa de Scraping (apps/scraper)
El sistema de scraping opera completamente aislado y está diseñado para ser deployable utilizando Docker, a diferencia del resto de las aplicaciones. Esto permite ejecutar el scraper en entornos controlados y reproducibles, independientemente de la infraestructura subyacente. 

No expone APIs públicas ni acepta conexiones entrantes. Su única función es extraer datos de tiendas, procesarlos y escribirlos a Supabase. Esta separación garantiza que problemas en los crawlers nunca afecten la experiencia del usuario final. Además, el uso de Docker facilita la escalabilidad horizontal y el despliegue en servidores dedicados o entornos locales.

## 3. Patrones de Diseño para Scraping

### 3.1 Patrón: Base Crawler Abstracto
Todos los crawlers heredan de una clase base abstracta que define el contrato y comportamiento común. Esto garantiza consistencia y facilita la adición de nuevas tiendas sin duplicar lógica.

**Responsabilidades del BaseCrawler:**
*   Rate limiting y respeto por robots.txt
*   Manejo de errores y reintentos con backoff exponencial
*   Logging estructurado de operaciones
*   User-Agent rotation y proxy management
*   Extracción de metadatos comunes (timestamps, URLs)

### 3.2 Patrón: Strategy para Selectores
Cada tienda tiene su propia estrategia de extracción implementada como un conjunto de selectores y transformadores. Cuando una tienda cambia su HTML, solo se actualiza su estrategia específica sin afectar otros crawlers. Los selectores se versionan y se mantiene fallback a selectores anteriores para resiliencia.

### 3.3 Patrón: Queue-Based Processing
El scraping no ocurre sincrónicamente. Las URLs a scrapear se encolan en Kuron con prioridades y metadatos. Workers independientes procesan la cola respetando rate limits por tienda. Esto permite paralelización controlada y recovery automático de fallos.

> **Ventaja:** Si un crawler falla, el job se reintenta automáticamente. Si una tienda está caída, los jobs se posponen sin bloquear el scraping de otras tiendas.

### 3.4 Patrón: Fingerprinting para Matching
El matching de productos entre tiendas utiliza un sistema de fingerprinting multicapa. Primero se intenta match por MPN (Part Number del fabricante), luego por EAN/UPC, y finalmente por fingerprint de especificaciones normalizadas. Cada método tiene un score de confianza asociado.

**Algoritmo de Matching:**
1.  Extraer MPN del título o metadatos (confianza: 95%)
2.  Buscar en base de datos por MPN exacto
3.  Si no hay match, extraer EAN de structured data (confianza: 100%)
4.  Si no hay match, generar fingerprint de specs normalizadas
5.  Buscar por fingerprint con umbral de similitud 0.85 (confianza: 75%)
6.  Si confianza menor a 80%, encolar para revisión manual

### 3.5 Patrón: Normalización de Datos
Los datos scrapeados pasan por un pipeline de normalización antes de almacenarse. Precios se convierten a números, textos se limpian de caracteres especiales, especificaciones se extraen con expresiones regulares y se validan contra schemas. Solo datos válidos y normalizados llegan a la base de datos.

### 3.6 Patrón: Incremental Updates
El scraper no reescribe toda la base de datos en cada ejecución. Utiliza timestamps y comparación de hashes para detectar cambios reales. Solo se actualizan productos cuyo precio, stock o URL han cambiado. El histórico de precios se mantiene en tabla separada para análisis temporal.

## 4. Estrategias de Modularidad

### 4.1 Shared Types Package
Todos los tipos TypeScript se definen en packages/db y packages/utils y se importan en todas las apps. Esto garantiza que frontend, API y scraper hablen el mismo lenguaje. Cambios en el schema de datos se propagan automáticamente y generan errores de compilación si algo no está sincronizado.

### 4.2 Plugin System para Crawlers
Cada tienda es un plugin independiente que se registra en el crawler manager. Agregar una nueva tienda consiste en crear un archivo nuevo que implemente la interfaz StoreCrawler. El sistema descubre automáticamente los crawlers disponibles y los ejecuta según configuración.

### 4.3 Configuration as Code
Toda configuración vive en código TypeScript con tipos estrictos. No hay archivos JSON o YAML que puedan corromperse. Las configuraciones de tiendas incluyen URLs base, selectores, rate limits, y headers HTTP. Los cambios se versionan en Git y se despliegan atómicamente.

### 4.4 Domain-Driven Design
El código está organizado por dominios de negocio, no por capas técnicas. Existe un dominio Product, uno Listing, uno Store, etc. Cada dominio tiene sus entidades, repositorios, servicios y validadores. Esto facilita el razonamiento sobre el código y previene acoplamiento excesivo.

## 5. Resiliencia y Manejo de Errores

### 5.1 Circuit Breaker Pattern
Si una tienda falla repetidamente (por ejemplo, está caída o bloqueó nuestro scraper), el circuit breaker la marca como unavailable temporalmente. Los crawlers dejan de intentar scrapearla por un período de cooldown. Esto previene que un sitio problemático consuma recursos innecesariamente.

### 5.2 Graceful Degradation
Si algunos campos no se pueden extraer (por ejemplo, el MPN no está presente), el scraper continúa con los datos disponibles. No hay all-or-nothing. Los productos se marcan con metadata indicando qué campos están incompletos para posterior revisión.

### 5.3 Dead Letter Queue
Los jobs que fallan múltiples veces van a una dead letter queue. Un proceso separado analiza estos fallos, agrupa por tipo de error, y genera alertas. Esto permite identificar problemas sistemáticos (como cambios en el HTML de tiendas) que requieren intervención humana.

### 5.4 Monitoring y Observabilidad
Cada crawler emite métricas estructuradas: productos scrapeados, errores, tiempos de respuesta, rate de matching exitoso. Estas métricas se agregan y permiten detectar degradaciones antes de que los usuarios lo noten. Dashboards muestran salud de cada tienda en tiempo real.

## 6. Optimización de Performance

### 6.1 Caching Estratégico
Los Workers cachean respuestas en Cloudflare KV con TTLs diferenciados. Listados de productos se cachean por 5 minutos, detalles específicos por 15 minutos, búsquedas populares por 1 minuto. Cache invalidation ocurre cuando el scraper actualiza datos relevantes.

### 6.2 Batch Processing
El scraper agrupa inserts y updates en batches. En lugar de hacer una query por producto, acumula cambios y los escribe en transacciones de 100 productos. Esto reduce dramáticamente la carga en Supabase y mejora throughput.

### 6.3 Indexación Inteligente
La base de datos tiene índices específicos para los queries más frecuentes: búsqueda por categoría y fabricante, lookup por MPN, joins de productos con listings. Los índices se monitorizan y optimizan basándose en query plans reales.

### 6.4 Lazy Loading de Imágenes
Las imágenes de productos se almacenan en Supabase Storage con transformaciones automáticas. El frontend carga thumbnails pequeños inicialmente y full-size solo cuando el usuario interactúa. Cloudflare Images puede agregarse posteriormente para CDN de imágenes.

## 7. Consideraciones de Seguridad

### 7.1 Separación de Credenciales
El scraper usa service role key de Supabase con acceso completo. Los Workers usan anon key con acceso limitado por RLS. El frontend no tiene credenciales en absoluto. Cada capa tiene exactamente los permisos que necesita, nada más.

### 7.2 Rate Limiting en API
Los Workers implementan rate limiting por IP usando Cloudflare KV. Los usuarios anónimos tienen límites más restrictivos que usuarios autenticados (si implementas auth). Esto previene abuso y scraping de tu propia API.

### 7.3 Sanitización de Inputs
Todos los datos scrapeados se sanitizan antes de almacenarse. HTML se stripea, JavaScript se remueve, URLs se validan. Esto previene XSS si un sitio externo intenta inyectar código malicioso en sus propios listados.

### 7.4 Servidor Local Aislado
El servidor de scraping no acepta conexiones entrantes. Solo hace requests salientes a tiendas y a Supabase API. No hay puertos expuestos, no hay superficie de ataque. Si necesitas administrarlo, usas Coolify localmente o SSH con keys.

## 8. Plan de Escalabilidad

### 8.1 Escalar Horizontalmente Crawlers
Cuando una tienda tenga miles de productos, puedes agregar más workers que procesen la misma queue. BullMQ garantiza que cada job se procesa exactamente una vez. Puedes tener 10 workers scrapeando en paralelo sin coordinación explícita.

### 8.2 Particionar por Categoría
A medida que agregues más categorías (no solo componentes PC), puedes crear crawlers especializados. Uno para GPUs, otro para CPUs, otro para periféricos. Cada uno es independiente y puede optimizarse para las particularidades de su categoría.

### 8.3 Read Replicas
Supabase soporta read replicas. Si el tráfico crece, puedes configurar los Workers para leer de replicas cercanas geográficamente mientras el scraper escribe al primary. Esto reduce latencia y carga en la base principal.

### 8.4 CDN para Assets Estáticos
Las imágenes de productos pueden migrarse a Cloudflare R2 o Images. Esto libera espacio en Supabase Storage y aprovecha el CDN global de Cloudflare para delivery ultra rápido. El cambio es transparente para el código gracias a abstracción de storage.

## 9. Mantenibilidad a Largo Plazo

### 9.1 Testing Strategy
Los crawlers tienen unit tests que mockean las respuestas HTTP. Cuando una tienda cambia su HTML, guardas el nuevo HTML como fixture y actualizas los tests. Los tests garantizan que tus selectores siguen funcionando. También hay integration tests que verifican el flujo completo sin tocar sitios reales.

### 9.2 Versionado de Selectores
Cada configuración de tienda tiene un número de versión. Cuando detectas que los selectores dejaron de funcionar, creas una nueva versión con los selectores actualizados. El sistema intenta primero la versión nueva, y si falla, hace fallback a la anterior. Esto da tiempo para debugging sin downtime.

### 9.3 Documentación Viviente
Cada crawler tiene comentarios explicando qué extrae y por qué. Las decisiones de diseño se documentan en el código mismo. Los tipos TypeScript sirven como documentación auto-actualizable. Un README en cada package explica su propósito y cómo usarlo.

### 9.4 Migrations Versionadas
Los cambios al schema de Supabase se hacen mediante migrations SQL versionadas. Nunca se modifica la base de datos manualmente. Cada migration tiene un rollback correspondiente. Esto permite deployments seguros y reversibles.

## 10. Conclusión y Próximos Pasos

La arquitectura propuesta para Framerate.cl balancea simplicidad en el inicio con capacidad de crecimiento futuro. El uso de tecnologías modernas como Bun, Cloudflare Workers y Supabase permite comenzar con costos mínimos mientras se mantiene la puerta abierta para escalar a millones de usuarios.

La separación estricta entre scraping, almacenamiento y presentación garantiza que cada componente pueda evolucionar independientemente. El monorepo con shared types asegura consistencia sin sacrificar modularidad.

### Roadmap Sugerido

1.  **Fase 1 - MVP (2-3 semanas):**
    *   Setup monorepo con Turborepo
    *   Schema de Supabase con 3 tiendas principales
    *   Crawler básico para 1 categoría (GPUs)
    *   API mínima en Workers
        *   Frontend básico con listado y comparación
        *   **Aquí vamos: Implementación de SPDigital en scraper** (estructura base y productos iniciales)
    2.  **Fase 2 - Refinamiento (2-3 semanas):**
    *   Agregar 5 tiendas más
    *   Implementar matching por fingerprint
    *   Sistema de queue con BullMQ
    *   Histórico de precios y gráficos
    *   Búsqueda y filtros avanzados
3.  **Fase 3 - Expansión (4-6 semanas):**
    *   Más categorías (CPUs, RAM, etc.)
    *   Alertas de precio para usuarios
    *   Sistema de recomendaciones
    *   Comparador de builds completos
    *   Monetización con links de afiliados

> **Nota Final:** Esta arquitectura está diseñada para ser implementada incrementalmente. No necesitas construir todo de una vez. Comienza con lo mínimo viable, valida con usuarios reales, y expande basándote en feedback y métricas. La modularidad te permite iterar rápidamente sin comprometer la calidad técnica.

....
bien ahora empezaremos con la implementacion de spdigital en scraper 

para esto empezaremos implementando la estructura base y luego empezaremos con los diferentes productos.  para sp digital hay dos formas de hacer las cosas hay mucha informacion expuesta mediante no renderizar javascript, el problema esta en que si bien hay mucha info tambien