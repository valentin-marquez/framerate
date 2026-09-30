# CLAUDE.md — apps/web

Reglas propias del frontend. Se suman a las del `CLAUDE.md` de la raíz.

## Animaciones y rendimiento del hilo principal

Queremos una web con mucho movimiento, pero que no le cueste al hilo principal (base: [The Expensive Main Thread](https://kciter.so/posts/the-expensive-main-thread/en/)). Un frame en 60 Hz dura ~16 ms y el navegador se lleva parte: nuestro presupuesto es **~10 ms por frame** (la mitad en 120 Hz). Una tarea de más de 50 ms es una *long task* y congela la pantalla.

- **Sólo se anima `transform` y `opacity`**: las procesa el compositor y siguen fluidas aunque el hilo principal esté ocupado. Nunca animar `width`, `height`, `top/left`, `margin`, `padding`, `border` ni `box-shadow`/`filter` (gatillan layout o paint). Tampoco hacer aparecer con fundido un elemento con `backdrop-filter` (p. ej. el velo de un diálogo): el desenfoque se aplica de golpe y se ve un salto; el velo va sin desenfoque (`bg-black/50`). Entradas/salidas de modales con CSS (`animate-in`/`animate-out` + `fill-mode-forwards`, desmontar en `onAnimationEnd`), no con `motion`: en un elemento que sólo anima opacidad, `motion` aplica el valor final un cuadro tarde y parpadea al terminar. Un tamaño que cambia se resuelve con `scale` o `clip-path`, no con `width`.
- **CSS antes que JS**: `@keyframes`/`transition`, o `motion` con `transform`/`opacity` (WAAPI). Nada de `setState` por frame ni de leer layout (`offsetHeight`, `getBoundingClientRect`) dentro de un bucle de animación.
- **La entrada escalonada es sólo para la carga inicial**: lo que se ve al abrir la página entra en cascada; lo que queda bajo el pliegue **no** aparece al hacer scroll ni al navegar, porque animar mientras se recorre el contenido estorba. Se usa `.enter-up` con `enterClass()`/`enterStyle(ms)` de `shared/lib/initial-load.ts` (CSS puro: no depende de que hidrate el JS ni retrasa el LCP; tras ~1,6 s dejan de aplicarse).
- **Nada de `whileInView` ni listeners de `scroll` para mostrar contenido.** Un listener de scroll/resize/input va con `passive`, `requestAnimationFrame` o throttle/debounce.
- **Cascadas cortas**: entrada de 0,4–0,7 s, escalonado de 50 ms y máximo ~6 elementos por grupo. Movimiento corto (≤ 16 px), con la curva ya usada (`cubic-bezier(0.22, 1, 0.36, 1)`).
- **El layout no puede cambiar al hidratar**: lo que depende del cliente (`matchMedia`, `localStorage`, tema) se resuelve con CSS o con un valor que el servidor ya conoce; un elemento que aparece o cambia de tamaño tras hidratar es un salto visible.
- **`prefers-reduced-motion`** se respeta siempre (hay una regla global en `app.css`). Todo efecto nuevo debe degradar a estático.
- **`will-change` sólo mientras dura la animación** y en pocos elementos; abusar de él consume memoria de GPU. Excepción: la foto de la tarjeta de producto (`.stage-image`), que sin capa fija salta 1 px al terminar de asentarse.
- **Trabajo pesado fuera del hilo principal**: si una tarea puede pasar de ~10 ms (parsear, filtrar, ordenar listas grandes) se divide en trozos de ~5 ms cediendo el control (`scheduler.yield()`, o `requestAnimationFrame` + `performance.now()`), o se mueve a un Web Worker. Listas largas: `content-visibility: auto` o virtualización.
- **Se mide, no se supone**: antes de dar por buena una animación nueva, Performance de DevTools con CPU ×4 y mirar INP/TBT. "El código es lento" no es lo mismo que "el código bloquea".


## Web: diseño y rutas

- Sistema de diseño en `.github/instructions/web.instructions.md` y en Storybook (`apps/web`): tipografía Inter,
  paleta neutra estilo Luma, superficies en capas (`bg-background` / `bg-card` / `bg-secondary`), radios squircle
  (`rounded-md` inputs, `rounded-xl`/`rounded-2xl` tarjetas, `rounded-3xl` modales).
- **URLs públicas en español** (`/tiendas/:slug`, `/reclamar`, `/explorar`, `/categoria/:slug`, `/producto/:slug`,
  `/cotizacion/:slug`). Al renombrar una ruta, la versión vieja queda como redirect 301
  (`apps/web/app/features/stores/pages/redirect-old-*.tsx`). APIs, tablas y código, en inglés.
- El estado de los filtros vive en los search params de la URL.
