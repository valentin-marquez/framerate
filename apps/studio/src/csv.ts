// Una celda de texto que empieza con = + - @ se ejecuta como fórmula al abrir el CSV en una planilla, y los datos
// vienen de tiendas y usuarios: se antepone ' para que quede como texto.
const cell = (v: unknown) => {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? `'${v}` : String(v);
  return `"${s.replaceAll('"', '""')}"`;
};

export const toCsv = (columns: string[], rows: unknown[][]) =>
  [columns, ...rows].map((row) => row.map(cell).join(",")).join("\n");
