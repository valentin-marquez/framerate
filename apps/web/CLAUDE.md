# CLAUDE.md — apps/web

Reglas propias del frontend. Se suman a las del `CLAUDE.md` de la raíz.

## Animaciones y rendimiento del hilo principal

Queremos una web con mucho movimiento, pero que no le cueste al hilo principal (base: [The Expensive Main Thread](https://kciter.so/posts/the-expensive-main-thread/en/)). Un frame en 60 Hz dura ~16 ms y el navegador se lleva parte: nuestro presupuesto es **~10 ms por frame** (la mitad en 120 Hz). Una tarea de más de 50 ms es una *long task* y congela la pantalla.

- **Sólo se anima `transform` y `opacity`**: las procesa el compositor y siguen fluidas aunque el hilo principal esté ocupado. Nunca animar `width`, `height`, `top/left`, `margin`, `padding`, `border` ni `box-shadow`/`filter` (gatillan layout o paint). Tampoco hacer aparecer con fundido un elemento con `backdrop-filter` (p. ej. el velo de un diálogo): el desenfoque se aplica de golpe y se ve un salto; el velo va sin desenfoque (`bg-black/50`). Entradas/salidas de modales con CSS (`animate-in`/`animate-out` + `fill-mode-forwards`, desmontar en `onAnimationEnd`), no con `motion`: en un elemento que sólo anima opacidad, `motion` aplica el valor final un cuadro tarde y parpadea al terminar. Un tamaño que cambia se resuelve con `scale` o `clip-path`, no con `width`.
- **CSS antes que JS**: `@keyframes`/`transition`, o `motion` con `transform`/`opacity` (WAAPI). Nada de `setState` por frame ni de leer layout (`offsetHeight`, `getBoundingClientRect`) dentro de un bucle de animación.
- **La entrada escalonada es sólo para la carga inicial**: lo que se ve al abrir la página entra en cascada; lo que queda bajo el pliegue **no** aparece al hacer scroll ni al navegar, porque animar mientras se recorre el contenido estorba. Se usa `.enter-up` con `enterClass()`/`enterStyle(ms)` de `shared/lib/initial-load.ts` (CSS puro: no depende de que hidrate el JS ni retrasa el LCP; tras ~1,6 s dejan de aplicarse).
- **Nada de `whileInView` ni listeners de `scroll` para mostrar contenido.** Un listener de scroll/resize/input va con `passive`, `requestAnimationFrame` o throttle/debounce.
- **Cascadas cortas**: duración `slow`, escalonado de 50 ms y máximo ~6 elementos por grupo. Movimiento corto (≤ 16 px).
- **El layout no puede cambiar al hidratar**: lo que depende del cliente (`matchMedia`, `localStorage`, tema) se resuelve con CSS o con un valor que el servidor ya conoce; un elemento que aparece o cambia de tamaño tras hidratar es un salto visible.
- **`prefers-reduced-motion`** se respeta siempre (hay una regla global en `app.css`). Todo efecto nuevo debe degradar a estático.
- **`will-change` sólo mientras dura la animación** y en pocos elementos; abusar de él consume memoria de GPU. Excepción: la foto de la tarjeta de producto (`.stage-image`), que sin capa fija salta 1 px al terminar de asentarse.
- **Trabajo pesado fuera del hilo principal**: si una tarea puede pasar de ~10 ms (parsear, filtrar, ordenar listas grandes) se divide en trozos de ~5 ms cediendo el control (`scheduler.yield()`, o `requestAnimationFrame` + `performance.now()`), o se mueve a un Web Worker. Listas largas: `content-visibility: auto` o virtualización.
- **Se mide, no se supone**: antes de dar por buena una animación nueva, Performance de DevTools con CPU ×4 y mirar INP/TBT. "El código es lento" no es lo mismo que "el código bloquea".

### Lenguaje de motion

Dos curvas y tres duraciones, nada más. Son tokens de `app.css` (`@theme static`): en Tailwind, `ease-out`,
`ease-in-out` y `duration-fast|base|slow`; en CSS, `var(--ease-out)` o `var(--transition-duration-base)`; en `motion`,
`EASE_OUT`, `EASE_IN_OUT` y `DURATION` de `shared/lib/motion.ts` (mismos valores; si cambias uno, cambia los dos). Se
ven en Storybook, Fundamentos/Movimiento.

| Movimiento | Curva | Duración |
| --- | --- | --- |
| Hover, foco, cambio de color | `ease-out` | `fast` (150 ms) |
| Entrada de algo chico (menú, popover, tooltip) | `ease-out` | `fast` |
| Entrada de algo grande (diálogo, panel, aviso, paso de un asistente) | `ease-out` | `base` (250 ms) |
| Salida | `ease-out` | `fast`: sale más rápido de lo que entra |
| Elemento que se transforma o se mueve en pantalla (el buscador que se acopla al navbar, la foto que pasa de una página a otra, el giro del logo) | `ease-in-out` | `base`, o `slow` si recorre media pantalla |
| Cambio de página (View Transitions) y cascada de la carga inicial | `ease-out` | `slow` (400 ms) |

- Un `transition-*` sin duración ni curva ya usa `fast` y `ease-out` (`--default-transition-*`): no hace falta escribirlas.
- `ease-in` no se usa: arranca lento y la interfaz parece que no respondió. Tampoco `linear`, salvo lo que gira o
  avanza sin fin (un spinner).
- Sin springs, salvo en lo que sigue al dedo (arrastrar, deslizar un carrusel): ahí la física da continuidad al soltar.
- Cambio de página: `<Link viewTransition>` (o `NavLink`); las reglas `::view-transition-*` están en `app.css`. Un
  elemento compartido lleva un `view-transition-name` que tiene que ser único en la página al capturarla: en una lista,
  sólo el elemento que navega lo lleva, y sólo mientras dura la transición (`useViewTransitionState(ruta)` o
  `isTransitioning` de `NavLink`). Volver atrás repite la transición sola.
- La excepción es una coreografía de varios tiempos sincronizados (la carga de la foto de producto, `.stage-*`): lleva
  su propia duración y curvas por tramo.


## Web: diseño y rutas

- Sistema de diseño en `.github/instructions/web.instructions.md` y en Storybook (`apps/web`): tipografía Satoshi,
  paleta neutra estilo Luma, superficies en capas (`bg-background` / `bg-card` / `bg-secondary`), radios squircle
  (`rounded-md` inputs, `rounded-xl`/`rounded-2xl` tarjetas, `rounded-3xl` modales).
- **URLs públicas en español** (`/tiendas/:slug`, `/reclamar`, `/explorar`, `/categoria/:slug`, `/producto/:slug`,
  `/cotizacion/:slug`). Al renombrar una ruta, la versión vieja queda como redirect 301
  (`apps/web/app/features/stores/pages/redirect-old-*.tsx`). APIs, tablas y código, en inglés.
- El estado de los filtros vive en los search params de la URL.
