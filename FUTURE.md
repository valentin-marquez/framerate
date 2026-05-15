# FUTURE.md

## Roadmap — Framerate.cl

> Última actualización: Mayo 2026

Este documento describe hacia dónde va el proyecto. Lo que ya está
implementado vive en [`README.md`](./README.md). Lo que sigue acá es
intencionalmente direccional: un compromiso con un *rumbo*, no con un
sprint plan.

---

## Estado actual (resumen)

Lo que ya funciona y no necesita planificación:

- **Catálogo y comparación** — 7 crawlers, ~10 categorías, histórico de
  precios, normalización con regex + LLM (DeepSeek), cache en Edge.
- **Cotizaciones** — armado, validación básica de compatibilidad,
  totalización, links públicos/privados, embeds inline en comentarios
  tipo Notion.
- **Comentarios** — threaded por producto, slash commands
  (`/cotizacion`), renderer con embeds, soft-delete.
- **Tiendas** — perfiles públicos, reseñas con voting "útil", flujo de
  reclamo verificado, panel de admin para dueños.
- **Identidad** — OAuth con sync de avatars, perfiles públicos con
  builds del usuario.
- **Moderación** — reportes, gatekeeper, bans, RLS-gated dashboards.
- **Tracking** — clicks outbound a tiendas con UTM (cobertura inicial
  en cards y product details).

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
- Mejor matching cross-store: ir más allá de MPN exacto con
  fingerprinting de specs normalizadas.

### Self-hosted friendly

Como la licencia explícitamente permite self-hosting no comercial,
vale la pena documentar el camino:

- Docker compose mínimo para `collector` + `tracker` + Postgres
  (Supabase self-hosted o Neon).
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
- **Notificaciones**: tabla `notifications` + worker en `cortex` que
  procesa eventos (insert en `comments`, `votes`, `price_history`,
  etc.) y crea filas. Render in-app + envío email opt-in.
- **Score / reputation** calculado periódicamente por `cortex`
  (materialized view o tabla cacheada con refresh cada 1-6h).
- **Feed**: fan-out vs fan-in; probablemente fan-in (calcular el feed
  on-read con queries indexadas, sin tabla de timeline) hasta que el
  volumen lo justifique.
- **Postgres como queue** ya está en uso para extracción IA
  (`ai_extraction_jobs`) — extender al worker de notificaciones en
  vez de meter Redis.

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

## Notas de método

Este roadmap es iterativo. Cada feature se implementa cuando:

1. Hay señal de demanda (uso de la pieza adyacente que la habilita).
2. La validación técnica está hecha (no introducir Redis sin
   demostrar que Postgres no alcanza).
3. Encaja con los principios del repo: separación de responsabilidades
   (web → api → db), URLs en español, RLS para todo, edge-first.

Lo que **no** está en este documento, intencionalmente:

- Mobile app nativa — la web SSR actual ya rinde bien en mobile.
- Cripto/blockchain/NFT — no aplica.
- Marketplace propio (vender directo) — fuera del scope; somos
  comparador, no vendedor.
- Internacionalización fuera de Chile — el valor del producto es la
  curaduría local. Replicar en otro mercado es un fork legítimo bajo
  la licencia, pero no es nuestro roadmap.
