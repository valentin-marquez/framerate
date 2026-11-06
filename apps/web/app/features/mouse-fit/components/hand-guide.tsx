/** Mano abierta con las dos medidas: el largo va de la muñeca a la punta del dedo medio y el ancho, por los nudillos. */
const OUTLINE = [
  "M178 606 C178 578 166 560 150 536 C126 500 98 474 76 438 L38 376 C24 352 30 330 50 320 C70 310 88 320 100 340 L124 382 C136 356 148.9 341 147 291 L142.3 91.1 A24 24 0 0 1 190.3 89.2 L201 289 C201.6 305 207.6 292.2 207.5 276.2 L208.9 42.7 A24.5 24.5 0 0 1 257.9 42.3 L262.5 275.8 C262.6 291.8 268.6 299.3 269 283.3 L277.6 75 A23.5 23.5 0 0 1 324.6 76.1 L323 284.7 C322.6 300.7 329 332.3 330.1 316.3 L344.3 161.9 A21 21 0 0 1 386.2 164.7 L379.9 319.7 C377 363.6 388 410 384 462 C380 506 350 540 346 606",
  "M124 382 C158 402 186 446 196 494",
];

export function HandGuide() {
  return (
    <svg
      viewBox="0 0 590 616"
      style={{ height: 224, width: 215 }}
      className="shrink-0 text-muted-foreground"
      role="img"
      aria-label="Mano abierta: el largo va de la muñeca a la punta del dedo medio y el ancho cruza los nudillos"
    >
      <g fill="none" stroke="currentColor" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round">
        {OUTLINE.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g className="text-foreground" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
        <path d="M478 18 V552 M466 18 H490 M466 552 H490" />
        <path d="M148 318 H381 M148 304 V332 M381 304 V332" />
        <path
          d="M233 18 H478 M150 552 H478"
          strokeDasharray="4 9"
          strokeWidth="2.5"
          className="text-muted-foreground"
        />
        <g stroke="none" fill="currentColor" fontSize="32" fontWeight="500">
          <text x="496" y="296">
            Largo
          </text>
          <text x="266" y="364" textAnchor="middle">
            Ancho
          </text>
        </g>
      </g>
    </svg>
  );
}
