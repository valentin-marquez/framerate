/** Mano abierta con las dos medidas: el largo va de la muñeca a la punta del dedo medio y el ancho, por los nudillos. */
export function HandGuide() {
  return (
    <svg
      viewBox="0 0 200 240"
      style={{ height: 208, width: 174 }}
      className="shrink-0 text-muted-foreground"
      role="img"
      aria-label="Mano abierta: el largo va de la muñeca a la punta del dedo medio y el ancho cruza los nudillos"
    >
      <path
        d="M62 222 V132 L34 102 C26 92 40 80 50 90 L62 104 V44 C62 32 80 32 80 44 V100 V28 C80 16 98 16 98 28 V100 V36 C98 24 116 24 116 36 V102 V56 C116 44 134 44 134 56 V150 C134 190 118 200 118 222 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <g className="text-foreground" stroke="currentColor" strokeWidth="2">
        <path d="M156 16 V222 M150 16 H162 M150 222 H162" />
        <path d="M62 112 H134 M62 106 V118 M134 106 V118" />
      </g>
      <text x="166" y="124" fontSize="13" fill="currentColor">
        Largo
      </text>
      <text x="78" y="132" fontSize="13" fill="currentColor">
        Ancho
      </text>
    </svg>
  );
}
