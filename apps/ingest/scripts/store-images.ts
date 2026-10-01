import { decodeEntities } from "@framerate/kit";
import { createHttpClient, USER_AGENT } from "../src/features/ingestion/stores/http";
import { STORES } from "../src/features/ingestion/stores/registry";

// Icono y banner de cada tienda sacados de su portada: icono = apple-touch-icon, el icono más grande o /favicon.ico;
// banner = og:image si es una imagen ancha y no un logo. Imprime los UPDATE para D1.
// Uso: `bun run store-images [tienda…] > /tmp/imagenes.sql` y luego
// `bunx wrangler d1 execute framerate --remote --file /tmp/imagenes.sql` (en packages/database).
const slugs = process.argv.slice(2);
const http = createHttpClient();

const attrs = (tag: string) =>
  Object.fromEntries([...tag.matchAll(/([\w:-]+)=["']([^"']*)["']/g)].map((m) => [m[1]?.toLowerCase(), m[2]]));
const sql = (v: string | null) => (v ? `'${v.replace(/'/g, "''")}'` : "NULL");

/** Ancho y alto desde la cabecera de un PNG, JPEG o WebP (sin decodificar la imagen). */
function imageSize(b: Uint8Array): [number, number] | null {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b[0] === 0x89 && b[1] === 0x50) return [v.getUint32(16), v.getUint32(20)];
  if (b[0] === 0x52 && b[8] === 0x57) {
    const chunk = String.fromCharCode(...b.slice(12, 16));
    if (chunk === "VP8 ") return [v.getUint16(26, true) & 0x3fff, v.getUint16(28, true) & 0x3fff];
    if (chunk === "VP8L") return [1 + (v.getUint16(21, true) & 0x3fff), 1 + ((v.getUint32(21, true) >> 14) & 0x3fff)];
    if (chunk === "VP8X") return [1 + (v.getUint32(24, true) & 0xffffff), 1 + (v.getUint32(27, true) & 0xffffff)];
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length; i += 2 + v.getUint16(i + 2)) {
      const marker = b[i + 1] ?? 0;
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return [v.getUint16(i + 7), v.getUint16(i + 5)];
      }
    }
  }
  return null;
}

async function isWide(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    const size = res.ok ? imageSize(new Uint8Array(await res.arrayBuffer())) : null;
    return !!size && size[0] >= 1000 && size[0] >= 2 * size[1];
  } catch {
    return false;
  }
}

for (const store of STORES) {
  if (slugs.length && !slugs.includes(store.slug)) continue;
  let html: string;
  let base: string;
  try {
    const res = await http.get(store.url, { accept: "text/html" });
    html = res.text;
    base = store.url;
  } catch (error) {
    console.error(`-- ${store.slug}: no respondió (${error instanceof Error ? error.message : error})`);
    continue;
  }
  const abs = (href: string | undefined) => (href ? new URL(decodeEntities(href), base).href : null);

  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => attrs(m[0]));
  const icons = links.filter((a) => /(^|\s)(apple-touch-icon|icon)(\s|$)/i.test(a.rel ?? ""));
  // El más grande; a igual tamaño (o sin `sizes`), apple-touch-icon, que suele ser de 180 px.
  const size = (a: Record<string, string | undefined>) =>
    Number(a.sizes?.match(/\d+/)?.[0] ?? a.href?.match(/(\d{2,3})x\1/)?.[1] ?? 0) +
    (/apple-touch-icon/i.test(a.rel ?? "") ? 0.5 : 0);
  const icon = abs(icons.sort((a, b) => size(b) - size(a))[0]?.href) ?? abs("/favicon.ico");

  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => attrs(m[0]));
  const ogImage = abs(
    metas.find((a) => /^(og:image(:secure_url)?|twitter:image)$/i.test(a.property ?? a.name ?? ""))?.content,
  );
  // Muchas tiendas publican su logo como og:image (a veces apaisado): sólo sirve si es ancha y no se llama "logo".
  const banner =
    ogImage && !/logo|favicon|icon/i.test(new URL(ogImage).pathname) && (await isWide(ogImage)) ? ogImage : null;

  console.log(
    `UPDATE stores SET scraped_icon_url = ${sql(icon)}, scraped_banner_url = ${sql(banner)} WHERE slug = '${store.slug}';`,
  );
}
