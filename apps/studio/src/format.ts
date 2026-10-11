const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

// Vista de ayuda bajo el editor de celda: JSON indentado o la fecha en hora de Chile. No cambia el valor guardado.
export function formatted(value: string | null): string | null {
  if (value === null) return null;
  if (ISO.test(value)) {
    const d = new Date(value);
    const f = new Intl.DateTimeFormat("es-CL", {
      timeZone: "America/Santiago",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(d);
    return `${f} (Chile)`;
  }
  if (/^\s*[[{]/.test(value)) {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {}
  }
  return null;
}

const DAY = 86_400_000;

// Serie diaria de los últimos `days` días UTC, con 0 donde la base no tiene filas, para que los gráficos compartan eje.
export function lastDays(rows: Record<string, unknown>[], key: string, days: number, now = Date.now()) {
  const byDay = new Map(rows.map((r) => [String(r.d), Number(r[key])]));
  const today = Math.floor(now / DAY) * DAY;
  return Array.from({ length: days }, (_, i) => {
    const ts = today - (days - 1 - i) * DAY;
    return [ts, byDay.get(new Date(ts).toISOString().slice(0, 10)) ?? 0] as [number, number];
  });
}
