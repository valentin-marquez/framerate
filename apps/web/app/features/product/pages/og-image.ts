import type { LoaderFunctionArgs } from "react-router";
import { ogImagePath } from "~/features/product/lib/share";
import { productsService } from "~/features/product/services/products";
import base from "../assets/og-product-base.jpg?inline";

// Panel blanco de la base (560×560 en x=320, y=35): la foto va adentro con 20 px de margen.
const PHOTO = { left: 340, top: 55, size: 520 };
const fallback = (request: Request) => Response.redirect(new URL("/og-image.png", request.url).href, 302);

/**
 * Imagen para compartir una ficha (1200×630, JPEG): la foto del producto sobre la base de la marca, armada con el
 * binding de Images. La foto cuadrada tal cual se recortaba en las tarjetas grandes. La URL lleva `?v=` con la foto,
 * así que se cachea sin vencer, y se guarda en R2 para armarla una sola vez: Images cobra cada mes de nuevo.
 */
export async function loader({ params, request, context }: LoaderFunctionArgs) {
  // `caches.default` existe en Workers; los tipos de la web son los del DOM.
  const cache = (caches as unknown as { default: Cache }).default;
  const hit = await cache.match(request);
  if (hit) return hit;

  const slug = (params.file ?? "").replace(/\.jpg$/, "");
  const product = await productsService.getBySlug(slug).catch(() => null);
  if (!product?.imageUrl) return fallback(request);
  // Sólo se compone la URL canónica: un `v` inventado saltaría la caché y cobraría una transformación por pedido.
  const canonical = new URL(ogImagePath(product.slug, product.imageUrl), request.url);
  if (canonical.href !== request.url) return Response.redirect(canonical.href, 301);

  const { IMAGES, ASSETS } = context.cloudflare.env;
  const key = `og/${product.slug}-${canonical.searchParams.get("v")}.jpg`;
  const headers = { "content-type": "image/jpeg", "cache-control": "public, max-age=604800, immutable" };
  const reply = (body: BodyInit) => {
    const response = new Response(body, { headers });
    context.cloudflare.ctx.waitUntil(cache.put(request, response.clone()));
    return response;
  };

  const stored = await ASSETS.get(key);
  if (stored) return reply(stored.body);

  const photo = await fetch(product.imageUrl).catch(() => null);
  if (!photo?.ok || !photo.body) return fallback(request);

  try {
    const card = await IMAGES.input(dataUrlStream(base))
      .draw(
        IMAGES.input(photo.body).transform({
          width: PHOTO.size,
          height: PHOTO.size,
          fit: "pad",
          background: "#FFFFFF",
        }),
        { left: PHOTO.left, top: PHOTO.top },
      )
      .output({ format: "image/jpeg", quality: 85 });
    const bytes = await new Response(card.image()).arrayBuffer();
    context.cloudflare.ctx.waitUntil(ASSETS.put(key, bytes, { httpMetadata: { contentType: "image/jpeg" } }));
    return reply(bytes);
  } catch (error) {
    console.error(JSON.stringify({ level: "error", msg: "og_image.failed", slug, error: String(error) }));
    return fallback(request);
  }
}

function dataUrlStream(dataUrl: string): ReadableStream<Uint8Array> {
  const bytes = Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(",") + 1)), (c) => c.charCodeAt(0));
  return new Blob([bytes]).stream();
}
