/**
 * @module og-card
 *
 * Genera imágenes Open Graph (1200×630) compuestas con `sharp`.
 *
 * @remarks
 * Las tarjetas se renderizan en el server (no en el edge): `sharp` ya está
 * disponible en `collector` y decodifica AVIF/WebP/PNG/JPEG nativamente, así
 * que no hay costo de cómputo en Cloudflare ni dependencias WASM.
 *
 * Composición deliberadamente mínima: logo Framerate + wordmark + foto del
 * producto + nombre. El precio/stock NO van en la imagen — eso la mantiene
 * estable por producto (cacheable `immutable` 1 año). Esos datos viajan por
 * `og:description` / `twitter:description`, que `web` renderiza frescos en SSR.
 */
import sharp from "sharp";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const BG = "#0B0B0C";
const FG = "#FAFAFA";
const MUTED = "#8A8A93";
const TILE = "#FFFFFF";
const FONT = "Helvetica, Arial, sans-serif";

/**
 * Paths del logo Framerate (viewBox 448×448), extraídos de
 * `apps/web/app/shared/components/layout/logo.tsx`. El 5º elemento del logo
 * es un `<rect>`, se añade aparte en {@link logoSvg}.
 */
const LOGO_PATHS = [
  "M0 5C0 2.24 2.24 0 5 0H135.42C138.18 0 140.42 2.24 140.42 5V442.27C140.42 445.03 138.18 447.27 135.42 447.27H5C2.24 447.27 0 445.03 0 442.27V5Z",
  "M442.27 0C445.03 0 447.27 2.24 447.27 5V135.42C447.27 138.18 445.03 140.42 442.27 140.42H5C2.24 140.42 0 138.18 0 135.42L0 5C0 2.24 2.24 0 5 0H442.27Z",
  "M162 209.042C162 206.278 164.239 204.037 167 204.037H304.8C307.561 204.037 309.8 206.278 309.8 209.042V441.995C309.8 444.759 307.561 447 304.8 447H167C164.239 447 162 444.759 162 441.995V209.042Z",
  "M442 170C444.761 170 447 172.241 447 175.005V307.147C447 309.912 444.761 312.153 442 312.153H167C164.239 312.153 162 309.912 162 307.147V175.005C162 172.241 164.239 170 167 170H442Z",
];

/** Renderiza el logo Framerate como un grupo SVG escalado y posicionado. */
function logoSvg(x: number, y: number, size: number, color: string): string {
  const scale = size / 448;
  const paths = LOGO_PATHS.map((d) => `<path d="${d}" fill="${color}"/>`).join("");
  const rect = `<rect x="339" y="339" width="108" height="108" rx="5" fill="${color}"/>`;
  return `<g transform="translate(${x},${y}) scale(${scale})">${paths}${rect}</g>`;
}

/** Escapa los caracteres reservados de XML para insertar texto en el SVG. */
function escapeXml(value: string): string {
  return value.replace(
    /[<>&'"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] as string,
  );
}

/**
 * Envuelve `text` en líneas de a lo más `maxChars` caracteres (greedy, por
 * palabra). Si excede `maxLines`, trunca y agrega elipsis a la última línea.
 */
function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1]}…`;
  }
  return lines;
}

/**
 * Renderiza la tarjeta OG de un producto: logo + wordmark a la izquierda,
 * foto del producto sobre un tile blanco, y el nombre del producto a la
 * derecha. Devuelve un PNG de 1200×630.
 */
export async function renderProductOgCard(opts: { productName: string; photo: Buffer }): Promise<Buffer> {
  // Geometría del tile blanco que contiene la foto.
  const tileX = 72;
  const tileY = 150;
  const tileW = 430;
  const tileH = 430;
  const tilePad = 38;
  const photoMax = tileW - tilePad * 2;

  // La foto se reduce para caber en el tile; no se amplía (evita pixelado).
  const photo = await sharp(opts.photo)
    .resize(photoMax, photoMax, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
  const meta = await sharp(photo).metadata();
  const photoW = meta.width ?? photoMax;
  const photoH = meta.height ?? photoMax;
  const photoLeft = Math.round(tileX + (tileW - photoW) / 2);
  const photoTop = Math.round(tileY + (tileH - photoH) / 2);

  // Nombre del producto: columna derecha, centrado verticalmente.
  const nameX = tileX + tileW + 56;
  const nameW = OG_WIDTH - nameX - 72;
  const fontSize = 46;
  const lineHeight = 58;
  const maxChars = Math.max(8, Math.floor(nameW / (fontSize * 0.56)));
  const lines = wrapText(opts.productName, maxChars, 5);
  const firstBaseline = Math.round((OG_HEIGHT - (lines.length - 1) * lineHeight) / 2);
  const tspans = lines
    .map((line, i) => `<tspan x="${nameX}" y="${firstBaseline + i * lineHeight}">${escapeXml(line)}</tspan>`)
    .join("");

  const svg = `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${BG}"/>
  ${logoSvg(72, 60, 52, FG)}
  <text x="142" y="100" font-family="${FONT}" font-size="32" font-weight="600" fill="${FG}">Framerate</text>
  <rect x="${tileX}" y="${tileY}" width="${tileW}" height="${tileH}" rx="32" fill="${TILE}"/>
  <text font-family="${FONT}" font-size="${fontSize}" font-weight="700" fill="${FG}">${tspans}</text>
</svg>`;

  return sharp(Buffer.from(svg))
    .composite([{ input: photo, left: photoLeft, top: photoTop }])
    .png()
    .toBuffer();
}

/**
 * Renderiza la tarjeta OG genérica de marca (sin producto): logo + wordmark +
 * tagline, centrados. Se usa como fallback estático (`web/public/og-image.png`)
 * para la home y páginas sin producto.
 */
export async function renderBrandOgCard(opts?: { tagline?: string }): Promise<Buffer> {
  const tagline = opts?.tagline ?? "Compara precios de hardware en Chile";
  const cx = OG_WIDTH / 2;

  const svg = `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${BG}"/>
  ${logoSvg(cx - 64, 188, 128, FG)}
  <text x="${cx}" y="438" text-anchor="middle" font-family="${FONT}" font-size="76" font-weight="700" fill="${FG}">Framerate</text>
  <text x="${cx}" y="494" text-anchor="middle" font-family="${FONT}" font-size="30" font-weight="400" fill="${MUTED}">${escapeXml(tagline)}</text>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
