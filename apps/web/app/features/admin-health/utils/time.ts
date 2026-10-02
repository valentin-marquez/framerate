const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** "hace 5 min", "hace 3 h", "hace 3 d". Recibe la hora de referencia para no depender del reloj del navegador. */
export function timeAgo(iso: string, nowIso: string): string {
  const ms = Math.max(0, Date.parse(nowIso) - Date.parse(iso));
  if (ms < MINUTE) return "hace un momento";
  if (ms < HOUR) return `hace ${Math.floor(ms / MINUTE)} min`;
  if (ms < 48 * HOUR) return `hace ${Math.floor(ms / HOUR)} h`;
  return `hace ${Math.floor(ms / (24 * HOUR))} d`;
}

/** "47 s", "1 min 51 s", "2 h 30 min". */
export function formatDuration(ms: number): string {
  if (ms < 1000) return "menos de 1 s";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return seconds % 60 === 0 ? `${minutes} min` : `${minutes} min ${seconds % 60} s`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} min`;
}
