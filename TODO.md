# TODO

Los pendientes viven en el tablero de Forgejo: [issues de framerate](https://git.nozz.skin/valentin/framerate/issues),
en el orden del [Roadmap](https://git.nozz.skin/valentin/framerate/issues/67) fijado. Este archivo sólo guarda el
registro de deploys.

Producción: web `framerate.cl`, API `api.framerate.cl` (Workers `framerate`, `framerate-server`, `framerate-ingest`, D1 `framerate`).

## Último deploy
- [x] Desplegado el 30-09-2026 (`17adce0`): migraciones 0009 y 0010, `framerate-ingest` y `framerate-server`. La web no cambió de comportamiento y sigue en `bb66fe3`.
- [x] Crawl posterior revisado: fuentes y RAM de Dust2 entraron, precio tarjeta en todas las ofertas (Dust2 +7 %, TecTec +4 % promedio).
- [x] Desplegado `framerate-ingest` con `11ffecb` (extractores de chipset/capacidad): +7 ofertas de Dust2 fuera de cuarentena. `ADMIN_TOKEN` rotado (copia local en `~/.config/framerate/admin-token`).
- [x] Desplegados `framerate-server` y la web `framerate` con `f70c976` (30-09-2026, 23:10 UTC): 404 reales con favicon, navbar con sesión desde el SSR, sin `/v1/quotes`, CSP de fuentes, reclamo y tuteo, scopes de Discord. Verificado en producción.
- [x] Desplegado `framerate-ingest` con `da72de4` (01-10-2026, ~01:50 UTC; versión `8f838262`): 21 tiendas, guardas nuevas de matching y vetos de `normalize`. GPU verificada en producción con un adaptador de cada tipo (MyShop, PC Factory, PC Express, Tecnomas, MyBox, Notebook Store, ETChile) y crawl completo encolado (179 corridas).
