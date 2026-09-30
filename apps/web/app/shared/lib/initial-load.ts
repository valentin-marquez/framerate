import type { CSSProperties } from "react";

/**
 * La entrada escalonada es sólo para la carga inicial de la página: nada aparece al hacer scroll ni al navegar,
 * porque animar mientras se recorre el contenido estorba. En el servidor y durante la hidratación
 * `finished` es falso (el HTML sale con la animación); `App` lo marca poco después de cargar.
 */
let finished = false;

export function markInitialLoadDone() {
  finished = true;
}

/** Clase de entrada (`.enter-up`), o vacío si la carga inicial ya terminó. */
export const enterClass = () => (finished ? "" : "enter-up");

/** Retraso de la cascada en ms; sin efecto cuando la carga inicial ya terminó. */
export const enterStyle = (delayMs = 0): CSSProperties | undefined =>
  finished ? undefined : ({ "--delay": `${delayMs}ms` } as CSSProperties);
