import { timingSafeEqual } from "node:crypto";
import sharp from "sharp";

/**
 * Achicador de fotos para ingest (#170): recibe una foto en el cuerpo y devuelve un WebP a uno de los anchos fijos.
 * No sabe de productos ni toca R2; ingest descarga la foto, la manda acá y guarda lo que vuelve.
 * `POST /resize?w=<ancho>` con `Authorization: Bearer <RESIZER_TOKEN>`; `GET /health` sin token.
 */
export const WIDTHS = [400, 800];
const MAX_BYTES = 10 * 1024 * 1024;

// ponytail: un proceso por vez y el resto en fila; el servidor también corre el relay. Sube el tope si ingest espera.
sharp.concurrency(1);
let queue: Promise<unknown> = Promise.resolve();
const oneAtATime = <T>(task: () => Promise<T>): Promise<T> => {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
};

export async function handle(req: Request, token: string): Promise<Response> {
  const url = new URL(req.url);
  if (url.pathname === "/health") return new Response("ok");
  if (url.pathname !== "/resize") return new Response("not found", { status: 404 });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (!authorized(req.headers.get("authorization"), token)) return new Response("forbidden", { status: 403 });
  const width = Number(url.searchParams.get("w"));
  if (!WIDTHS.includes(width)) return new Response(`w debe ser ${WIDTHS.join(" o ")}`, { status: 400 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES) return new Response("too large", { status: 413 });
  const input = await req.arrayBuffer();
  if (input.byteLength > MAX_BYTES) return new Response("too large", { status: 413 });

  try {
    // Sin SVG ni formatos raros: lo que no sea foto lo rechaza ingest antes, y acá falla en vez de rasterizar.
    const webp = await oneAtATime(() =>
      sharp(input, { limitInputPixels: 40_000_000 })
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer(),
    );
    return new Response(webp, { headers: { "content-type": "image/webp" } });
  } catch (error) {
    return new Response(`resize: ${error instanceof Error ? error.message : String(error)}`, { status: 422 });
  }
}

function authorized(header: string | null, token: string): boolean {
  const given = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(given);
  const b = Buffer.from(token);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

if (import.meta.main) {
  const token = process.env.RESIZER_TOKEN;
  if (!token) throw new Error("Falta RESIZER_TOKEN");
  const server = Bun.serve({
    port: Number(process.env.PORT ?? 3000),
    maxRequestBodySize: MAX_BYTES,
    fetch: (req) => handle(req, token),
  });
  console.log(`resizer en :${server.port}`);
}
