/** Cron de la ingesta (`apps/ingest/wrangler.jsonc`): cada 6 horas, a los :17 en UTC. */
export const CRAWL_EVERY_HOURS = 6;
export const CRAWL_MINUTE_UTC = 17;

/** Próxima corrida programada después de `now`. */
export function nextCrawlAt(now: Date): Date {
  const next = new Date(now);
  next.setUTCMinutes(CRAWL_MINUTE_UTC, 0, 0);
  next.setUTCHours(Math.floor(now.getUTCHours() / CRAWL_EVERY_HOURS) * CRAWL_EVERY_HOURS);
  while (next <= now) next.setUTCHours(next.getUTCHours() + CRAWL_EVERY_HOURS);
  return next;
}
