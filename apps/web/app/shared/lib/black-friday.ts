// ponytail: fechas a mano (hora de Chile, verano UTC-3); el próximo evento cambia estas dos líneas.
const START = Date.parse("2026-11-27T00:00:00-03:00");
const END = Date.parse("2026-12-01T00:00:00-03:00");

/** Mientras dura, se ven la página, la entrada del riel, la pestaña y el aviso de la portada; después desaparecen solos. */
/** Días que quedan, contando el de hoy. */
export const blackFridayDaysLeft = (now = Date.now()) => Math.max(0, Math.ceil((END - now) / 86_400_000));

export const isBlackFriday = (now = Date.now()) => now >= START && now < END;

export const BLACK_FRIDAY_UNTIL = "Hasta el lunes 30 de noviembre";
