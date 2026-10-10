import type { LoaderFunctionArgs } from "react-router";
import { productsService } from "~/features/product/services/products";
import base from "../assets/og-product-base.jpg?inline";

// Panel blanco de la base (560×560 en x=320, y=35): la foto va adentro con 20 px de margen.
const PHOTO = { left: 340, top: 55, size: 520 };
const fallback = (request: Request) => Response.redirect(new URL("/og-image.png", request.url).href, 302);

/**
 * Imagen para compartir una ficha (1200×630, JPEG): la foto del producto sobre la base de la marca, armada con el
 * binding de Images. La foto cuadrada tal cual se recortaba en las tarjetas grandes. La URL lleva `?v=` con la foto,
 * así que se cachea sin vencer.
 */
export async function loader({ params, request, context }: LoaderFunctionArgs) {
  // `caches.default` existe en Workers; los tipos de la web son los del DOM.
  const cache = (caches as unknown as { default: Cache }).default;
  const hit = await cache.match(request);
  if (hit) return hit;

  const slug = (params.file ?? "").replace(/\.jpg$/, "");
  const product = await productsService.getBySlug(slug).catch(() => null);
  const photo = product?.imageUrl ? await fetch(product.imageUrl).catch(() => null) : null;
  if (!photo?.ok || !photo.body) return fallback(request);

  try {
    const { IMAGES } = context.cloudflare.env;
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
    const response = new Response(card.image(), {
      headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=604800, immutable" },
    });
    context.cloudflare.ctx.waitUntil(cache.put(request, response.clone()));
    return response;
  } catch (error) {
    console.error(JSON.stringify({ level: "error", msg: "og_image.failed", slug, error: String(error) }));
    return fallback(request);
  }
}

function dataUrlStream(dataUrl: string): ReadableStream<Uint8Array> {
  const bytes = Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(",") + 1)), (c) => c.charCodeAt(0));
  return new Blob([bytes]).stream();
}
