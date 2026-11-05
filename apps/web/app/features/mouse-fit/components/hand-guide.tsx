/** Mano abierta con las dos medidas: el largo va de la muñeca a la punta del dedo medio y el ancho, por los nudillos. */
const OUTLINE = [
  "M130 335 V95 C130 70 145 58 167 58 C190 58 205 72 205 95 V237",
  "M205 237 V52 C205 24 222 8 245 8 C268 8 283 24 283 52 V232",
  "M283 232 V78 C283 52 298 40 320 40 C342 40 357 54 357 78 V248",
  "M357 248 V108 C357 80 374 67 393 67 C414 67 428 84 428 108 V360 C428 470 345 545 255 545 C185 545 135 510 100 445 L22 316 C10 300 8 285 18 273 C30 258 56 258 72 275 L130 335",
  "M130 335 C190 325 237 345 250 405",
];

export function HandGuide() {
  return (
    <svg
      viewBox="0 0 590 556"
      style={{ height: 224, width: 238 }}
      className="shrink-0 text-muted-foreground"
      role="img"
      aria-label="Mano abierta: el largo va de la muñeca a la punta del dedo medio y el ancho cruza los nudillos"
    >
      <g fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round">
        {OUTLINE.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g className="text-foreground" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
        <path d="M478 8 V545 M466 8 H490 M466 545 H490" />
        <path d="M130 292 H428 M130 278 V306 M428 278 V306" />
        <path d="M245 8 H478 M255 545 H478" strokeDasharray="4 9" strokeWidth="2.5" className="text-muted-foreground" />
        <g stroke="none" fill="currentColor" fontSize="29" fontWeight="500">
          <text x="498" y="285">
            Largo
          </text>
          <text x="279" y="335" textAnchor="middle">
            Ancho
          </text>
        </g>
      </g>
    </svg>
  );
}
