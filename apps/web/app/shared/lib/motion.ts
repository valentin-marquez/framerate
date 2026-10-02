// Los tokens de motion de app.css (`--ease-*`, `--transition-duration-*`) para `motion`, que no lee variables CSS.
// Si cambias un valor, cámbialo en los dos lados.
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;
export const DURATION = { fast: 0.15, base: 0.25, slow: 0.4 } as const;
