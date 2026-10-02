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

export { formatCLP, formatDateTime };
