# FUTURE.md

## Roadmap — Framerate.cl

> Última actualización: Mayo 2026

Este documento describe hacia dónde va el proyecto. Lo que ya está
implementado vive en [`README.md`](./README.md). Lo que sigue acá es
intencionalmente direccional: un compromiso con un *rumbo*, no con un
sprint plan.

---

## Estado actual (resumen)

Lo que ya funciona sobre la arquitectura v2 (Workers + D1):

- **Catálogo y comparación**: 2 tiendas (TecTec, Dust2), 10 categorías,
  historial de precios, matching por huella con revisión humana.
  Candidatas para crecer en `docs/store-candidates.md`.
- **Tiendas**: perfiles públicos, reseñas con voto "útil", reclamo
  verificado por DNS, miembros de la organización.
- **Identidad**: login con Discord (Better Auth), perfiles públicos,
  roles y sanciones.
- **Moderación**: usuarios, sanciones, revisión de matches, corridas y
  cuarentena del scraping.

Con el esquema listo pero **sin backend todavía**: cotizaciones,
comentarios, reportes de contenido, soporte y tracking de clicks
salientes. El sistema anterior las tenía; hay que reconstruirlas en v2.

---

## Próxima apuesta: comunidad de armadores

La hipótesis es que un comparador de precios chileno se diferencia
sostenidamente cuando hay **conversación y curaduría comunitaria**
arriba del catálogo. La data cruda la tienen muchos; la opinión
informada de gente que ya armó esa build no.

Las funcionalidades sociales se construyen sobre lo que ya existe
(perfiles, cotizaciones, comentarios, reseñas) y se priorizan en este
orden:

### 1. Builds como objeto social de primera clase

Hoy una cotización es un carrito guardado. La idea es promoverla a
*build*: algo que tiene autor visible, contexto (presupuesto, uso
declarado: gaming/edición/oficina), notas, y un ciclo de vida
(borrador → publicada → arquivada).

- **Voting** sobre builds publicadas (útil / no útil) con anti-abuse
  (un voto por usuario, decae con el tiempo).
- **Save / Bookmark** para construir tu lista privada de builds que te
  gustaron.
- **Forks** explícitos: "armar a partir de" deja un link bidireccional
  entre la build original y la derivada.
- **Estado de stock** automático: si un componente queda sin stock en
  todas las tiendas, marcar la build como "stale" sin esconderla.

### 2. Ranking y reputación de armadores

Los buenos armadores deberían destacar por encima del ruido.

- **Score por usuario** ponderado por: votos en builds publicadas,
  votos útiles en comentarios, reseñas con respaldo de la comunidad,
  reportes que terminaron en moderación correcta.
- **Tiers visibles** en el perfil (sin gamificación cringe — un badge
  discreto del estilo "Armador verificado", "Top reviewer mes",
  "Curador de tienda").
- **Leaderboard mensual** por categoría: armadores más útiles en GPU,
  CPU, builds bajo $500k, builds para edición, etc. Reset suave (no
  rolling all-time).

### 3. Feed social y descubrimiento

Hoy el home muestra productos populares. Falta una entrada para "qué
está pasando en la comunidad".

- **Feed personalizado**: builds nuevas de gente que sigues, productos
  comentados, reseñas relevantes para tus búsquedas recientes.
- **Trending por presupuesto**: las builds más voted en los últimos 7
  días, segmentadas por banda de presupuesto chilena (sub $300k, $300-
  600k, $600k-1M, +$1M).
- **Editor's picks** — slot manual para destacar builds curadas por
  los moderadores (sin algoritmo, intencional).

### 4. Follows y notificaciones

- **Seguir armadores** y/o **seguir tiendas** con su propio feed.
- **Notificaciones** in-app y opcionalmente por email:
  - Alguien comentó / forkeó tu build.
  - Una build que guardaste cambió de precio (>X% o cruzó tu umbral).
  - Una tienda que sigues publicó respuesta a tu reseña.
  - Un armador que sigues publicó algo nuevo.
- **Mentions** `@usuario` en comentarios con notificación.

### 5. Identidad pública más rica

- Perfil con bio, foto, builds publicadas, reseñas escritas, badges,
  últimas actividades.
- **Username canónico** ya existente (`/u/:username`) — falta UI de
  selección al registrarse y panel para reclamarlo / cambiarlo.
- **Perfil de tienda** simétrico: respuestas a reseñas, builds en las
  que aparece, tasa de stock real vs publicado.

---

## Otras bets en evaluación

Cosas que tienen sentido pero no son la apuesta principal este ciclo:

### Asistente IA de cotización

LLM con function calling para armar una build conversacionalmente
("quiero $500k para Cyberpunk en 1440p"). Ya hay piezas: catálogo
normalizado, motor de compatibilidad básico, cotizaciones manuales
como cimiento. Se mantiene en evaluación porque (a) los costos por
sesión hay que medirlos contra el upside, y (b) la apuesta social
arriba debería traer suficiente engagement antes de invertir en un
copilot.

### Cobertura del catálogo

- Más tiendas chilenas (objetivo: 12+ crawlers).
- Más categorías: periféricos (mouse/teclado/audio), monitores,
  notebooks pre-armados.
- Mejor matching cross-store: la huella multicapa (ver
  `docs/architecture.md` §5).

### Self-hosted friendly

Como la licencia explícitamente permite self-hosting no comercial,
vale la pena documentar el camino:

- Guía de despliegue en una cuenta propia de Cloudflare (D1, Queues,
  R2 y los tres Workers; ver `docs/architecture.md` §7).
- Variables de entorno bien documentadas con defaults sensatos.
- Guía de "cómo cambiar el branding" antes de desplegar (per LICENSE).

### Analítica para tiendas reclamadas

El tracking de outbound clicks ya existe — falta exponer un panel
para tiendas reclamadas con: clicks por producto, tasa de conversión
estimada, productos con más interés vs sin stock. Posible base para
una conversación comercial con tiendas más adelante.

---

## Cambios técnicos que habilitan lo de arriba

- **Tabla `builds`** (rebrand de `quotes` para uso público) con
  estado, autor visible, votos, forks, contexto declarado.
- **Sistema de votos genérico** reusable (votes en comentarios ya
  existe; extender a builds y reseñas con la misma infra).
- **Notificaciones**: tabla `notifications` + un consumidor de Queues
  que procesa eventos (comentarios, votos, cambios de precio) y crea
  filas. Render in-app + envío email opt-in.
- **Score / reputation** calculado periódicamente por un Cron
  (tabla cacheada con refresh cada 1-6h).
- **Feed**: fan-out vs fan-in; probablemente fan-in (calcular el feed
  on-read con queries indexadas, sin tabla de timeline) hasta que el
  volumen lo justifique.
- **Cloudflare Queues** ya mueve los crawls — reusarla para
  notificaciones en vez de sumar otra infraestructura.

---

## Decisiones pendientes

- ¿Voting en builds requiere cuenta? Probablemente sí — sin auth no
  se puede medir reputación. ¿Voto anónimo en comentarios sí o no?
- ¿Cómo manejamos forks de builds cuando la build original cambia
  (precio, item descontinuado)? ¿Snapshot al momento del fork o
  referencia viva?
- ¿Reputación es global o segmentada por categoría? (Argumento por
  segmentada: alguien que arma builds de oficina no necesariamente
  sabe de overclock.)
- ¿Cuánto del feed personalizado se calcula server-side cacheado vs
  on-demand por usuario activo?
- ¿Notificaciones por email desde día uno o sólo in-app + push web?

---

## DNS one-click vía Domain Connect (reclamo de tienda)

El flujo de reclamo de tienda verifica propiedad con un registro TXT que
el usuario agrega a mano. La Fase 1 (en producción) detecta el provider
DNS del dominio y muestra una guía específica. El paso siguiente sería un
**one-click real**: que Framerate cree el registro TXT por el usuario.

Se evaluó e **se descartó por ahora** — no por inviabilidad técnica sino
por costo/beneficio en estado pre-producción.

**Opción A — Domain Connect (estándar, preferida a largo plazo).**
Estándar abierto (domainconnect.org); Cloudflare soporta el flujo
síncrono. El usuario aprueba en una pantalla de consentimiento de su
propio proveedor, sin pegar tokens, y un único template cubre todos los
providers que soporten el estándar (Cloudflare, GoDaddy, IONOS, …).
Bloqueante: requiere un **onboarding manual** que no controlamos —
publicar un template (PR a `Domain-Connect/Templates`), firmar las apply
URLs (keypair RSA + public key en DNS) y pedir revisión a
`domain-connect@cloudflare.com`, sin SLA. El discovery (`_domainconnect`)
ya está probado: Cloudflare publica el record en todas sus zonas.

**Opción B — Token-paste de Cloudflare (puente sin onboarding).**
El usuario crea un API token scopeado (deep link que pre-llena los
permisos) y lo pega; el backend crea el TXT vía API y descarta el token.
Funciona sin depender de nadie, pero es una integración por provider y
tiene un paso de copiar/pegar.

**Cuándo retomarlo:** post-producción, cuando haya volumen real de
reclamos y se mida cuántos fallan por fricción del paso manual. Camino
sugerido: token-paste como puente → Domain Connect como destino.

---

## Notas de método

Este roadmap es iterativo. Cada feature se implementa cuando:

1. Hay señal de demanda (uso de la pieza adyacente que la habilita).
2. La validación técnica está hecha (no sumar infraestructura sin
   demostrar que D1 + Queues no alcanza).
3. Encaja con los principios del repo: separación de responsabilidades
   (web → server → D1), URLs en español, autorización en la API,
   edge-first.

Lo que **no** está en este documento, intencionalmente:

- Mobile app nativa — la web SSR actual ya rinde bien en mobile.
- Cripto/blockchain/NFT — no aplica.
- Marketplace propio (vender directo) — fuera del scope; somos
  comparador, no vendedor.
- Internacionalización fuera de Chile — el valor del producto es la
  curaduría local. Replicar en otro mercado es un fork legítimo bajo
  la licencia, pero no es nuestro roadmap.
