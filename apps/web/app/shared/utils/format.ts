const clpFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const formatCLP = (amount: number) => clpFormatter.format(amount);

const dateTimeParts = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "America/Santiago",
});

/**
 * "01-10-2026 21:05", hora de Chile. Se arma con las partes numéricas: `toLocaleString` cambia los espacios de
 * "p. m." según la versión de ICU, y el texto del servidor no calza con el del navegador al hidratar.
 */
const formatDateTime = (iso: string) => {
  const part = Object.fromEntries(dateTimeParts.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${part.day}-${part.month}-${part.year} ${part.hour}:${part.minute}`;
};

/** Duración corta para el riel: "menos de 1 min", "23 min", "4 h 12 min", "2 días". */
const formatSpan = (ms: number) => {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  if (minutes < 1) return "menos de 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours >= 48) return `${Math.floor(hours / 24)} días`;
  return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
};

export { formatCLP, formatDateTime, formatSpan };
