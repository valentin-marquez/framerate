/**
 * Genera la tarjeta Open Graph estática de marca en `apps/web/public/og-image.png`.
 *
 * Es el fallback que usan la home y cualquier página sin producto (referenciado
 * por `og:image` / `twitter:image` en `apps/web/app/root.tsx`). Re-ejecutar este
 * script regenera el archivo — commitearlo junto al cambio.
 *
 * Uso (desde la raíz del repo):
 *   bun run --cwd apps/collector gen:static-og
 */

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderBrandOgCard } from "@/lib/og-card";

const OUTPUT = resolve(import.meta.dir, "../../web/public/og-image.png");

const card = await renderBrandOgCard();
await writeFile(OUTPUT, card);

console.log(`Wrote ${OUTPUT} (${card.byteLength} bytes)`);
