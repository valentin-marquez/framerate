# Fuentes de referencias

Catálogo de dónde buscar y cómo. Los patrones marcados como **verificado** se probaron con el Playwright MCP; los demás son el punto de partida y, si fallan, usa el buscador del propio sitio.

## Principales (las favoritas del usuario)

### Dribbble
- **Buscar:** `https://dribbble.com/search/<termino-con-guiones>` (verificado). Ej.: `https://dribbble.com/search/event-archive-website`.
- Las páginas de etiqueta (`/tags/<x>`) traen muy pocos resultados: usa `/search`.
- Cada trabajo está en `https://dribbble.com/shots/<id>-<slug>` (verificado). Abre la ficha y captura la lámina grande; en la grilla solo hay miniaturas.
- Mañas: banner promocional arriba (se cierra con la X). Muchos resultados son maquetas de apps, identidades o promociones: descártalas y quédate con páginas web completas. Son conceptos, no productos reales.
- **Lámina original en alta resolución** (verificado): en la ficha, la imagen viene como `https://cdn.dribbble.com/userupload/<n>/file/<hash>.png?resize=1024x768&vertical=center`. Quitando todo desde `?` el CDN entrega el original (hasta 4800 px de ancho). Se baja con `curl` sin pasar por la página. Capturar el elemento en pantalla solo da 1024x768.
- **Límite de visitas** (verificado): tras unas 15 fichas seguidas responde "Human Verification" (HTTP 405). Junta primero las URLs de imagen de las fichas que vas a usar y descarga los originales por el CDN, que no bloquea.

### layers.to
- **Buscar:** no existe `/search?q=`. Usa `https://layers.to/search/<termino>?keyword=<termino>&sortBy=trending` (verificado, con el término codificado, ej. `event%20page`) o escribe en el campo "Search Layers..." visible.
- **Por etiqueta:** `https://layers.to/explore?tags=<tag>` (verificado). Etiquetas útiles: `website`, `landing-page`, `web-design`, `dashboard`, `saas`, `mobile-app`, `ui`, `minimal`.
- Mañas: es una SPA; espera unos 5 segundos antes de leer o capturar. Hay dos campos de búsqueda en el DOM y uno está oculto: usa el visible (`input[name="keyword"]:visible`).
- Las tarjetas de la grilla no son enlaces `<a>`: abre la ficha haciendo clic en la imagen. La ficha es `https://layers.to/layers/<id>-<slug>`.
- **Original en alta resolución** (verificado): la imagen viene como `https://layers-r2.com/cdn-cgi/image/width=2560,format=avif/<archivo>.jpg`. Quitando `cdn-cgi/image/.../` queda `https://layers-r2.com/<archivo>.jpg`, el original (3840x2880).

### 21st.dev
- **Por tipo de bloque:** `https://21st.dev/community/components/s/<categoria>` (verificado). Categorías: `hero`, `cta`, `features`, `footer`, `faq`, `pricing`, `testimonials`, `navbar`, `clients`, `comparison`, `background`, `announcement`, entre otras.
- Cada componente está en `https://21st.dev/@<autor>/components/<slug>`.
- Sirve para resolver secciones sueltas (cómo se arma un hero con buscador, un pie con muchos enlaces, una grilla de tarjetas) más que páginas completas. También tiene plantillas completas en su sección Templates.
- El código que muestra es de React y Tailwind: úsalo como referencia de estructura, no lo copies.

## Galerías de sitios

- **Awwwards:** `https://www.awwwards.com/websites/<categoria>/` (verificado con `events`). Sitios reales premiados, muy expresivos; útiles para ideas de jerarquía, poco para sitios institucionales.
- **Behance:** `https://www.behance.net/search/projects?search=<termino>`. Casos completos con varias láminas; abre el proyecto.
- **Land-book:** `https://land-book.com/` con su buscador. Landing pages reales.
- **Lapa Ninja:** `https://www.lapa.ninja/` con su buscador. Landings por categoría.
- **Godly:** `https://godly.website/`. Sitios con mucho movimiento.
- **One Page Love:** `https://onepagelove.com/`. Páginas de una sola pantalla larga.
- **SiteInspire:** `https://www.siteinspire.com/`. Sitios más sobrios, bueno para institucional y editorial.
- **SaaS Landing Page:** `https://saaslandingpage.com/`. Landings de producto.
- **Mobbin** y **Page Flows:** flujos de apps reales, pero piden cuenta. Úsalos solo si ya hay sesión; si piden login, sáltalos.

Las galerías también sirven para descubrir sitios: cuando algo sirve, visita y captura el sitio original.

## Sitios reales por rubro

Para institucional, gobierno y datos (el caso más común en proyectos del Estado):

- **Gobierno:** gov.uk (y su sistema de diseño), gob.cl y digital.gob.cl, gub.uy, gobiernos de Nueva Zelanda, Estonia y Canadá.
- **Organismos internacionales:** ONU (`un.org/en/climatechange`), CEPAL (`cepal.org`), FAO, PNUD, IPCC, Agencia Europea de Medio Ambiente (`eea.europa.eu`), Agencia Internacional de Energía (`iea.org`).
- **Datos y reportes:** Our World in Data, Copernicus Climate, Climate Watch, portales de datos abiertos.
- **Archivos y registros históricos:** Ars Electronica (`ars.electronica.art/festival/en/archive/`) es un buen ejemplo de archivo por año.

Para otros rubros, busca los tres o cuatro sitios líderes del sector y captúralos igual.
