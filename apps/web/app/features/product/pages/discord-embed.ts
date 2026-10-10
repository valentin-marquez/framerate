import type { LoaderFunctionArgs } from "react-router";
import { discordEmbed } from "~/features/product/lib/share";
import { productsService } from "~/features/product/services/products";

/** JSON de la tarjeta de Discord de una ficha (`<link rel="discord:component-embed">` en su `<head>`). */
export async function loader({ params, request }: LoaderFunctionArgs) {
  try {
    const product = await productsService.getBySlug(params.slug ?? "");
    return Response.json(discordEmbed(product, new URL(request.url).origin), {
      headers: { "cache-control": "public, max-age=600" },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
