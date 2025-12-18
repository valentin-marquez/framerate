// Esta es una ruta placeholder de momento solo para verificar funcionalidad de la API. No es el producto final.
// TODO: Reemplazar esta ruta con la implementación final.

import { ExternalLink } from "lucide-react";
import { AsyncImage } from "@/components/primitives/async-image";
import { Badge } from "@/components/primitives/badge";
import { Button } from "@/components/primitives/button";
import { productsService } from "@/services/products";
import type { Route } from "./+types/product";

export function meta({ data }: Route.MetaArgs) {
  if (!data) {
    return [{ title: "Producto no encontrado" }];
  }
  return [
    { title: `${data.name} - Framerate` },
    {
      name: "description",
      content: `Cotiza ${data.name} al mejor precio en Chile`,
    },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  try {
    const product = await productsService.getBySlug(params.slug);
    return product;
  } catch (_error) {
    throw new Response("Producto no encontrado", { status: 404 });
  }
}

export default function ProductPage({ loaderData }: Route.ComponentProps) {
  const product = loaderData;

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
    }).format(amount);

  return (
    <div className="container mx-auto p-4 py-8">
      <div className="grid gap-8 md:grid-cols-2">
        {/* Image Section */}
        <div className="aspect-square overflow-hidden rounded-lg border border-border bg-card">
          <AsyncImage
            src={product.image_url || undefined}
            alt={product.name || "Producto"}
            className="h-full w-full object-contain p-8"
          />
        </div>

        {/* Details Section */}
        <div className="flex flex-col gap-6">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="outline">{product.brand?.name}</Badge>
              <Badge variant="secondary">{product.category?.name}</Badge>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
            {product.mpn && <p className="mt-1 text-sm text-muted-foreground">MPN: {product.mpn}</p>}
          </div>

          {/* Specs */}
          {product.specs && (
            <div className="rounded-lg border border-border p-4">
              <h3 className="mb-3 font-semibold">Especificaciones</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(product.specs).map(([key, value]) => {
                  if (!value || typeof value === "object") return null;
                  return (
                    <div key={key} className="flex flex-col">
                      <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                      <span className="font-medium">{String(value)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Listings */}
          <div>
            <h3 className="mb-4 text-xl font-semibold">Tiendas</h3>
            <div className="space-y-3">
              {product.listings.map((listing) => (
                <div
                  key={listing.url}
                  className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-center gap-4">
                    {listing.store.logo_url && (
                      <img src={listing.store.logo_url} alt={listing.store.name} className="h-8 w-20 object-contain" />
                    )}
                    <div>
                      <p className="font-medium">{listing.store.name}</p>
                      <p className="text-xs text-muted-foreground">Actualizado: {listing.last_scraped_at}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold text-lg">{formatPrice(listing.price_cash)}</p>
                      {listing.price_normal > listing.price_cash && (
                        <p className="text-xs text-muted-foreground line-through">
                          {formatPrice(listing.price_normal)}
                        </p>
                      )}
                    </div>
                    <Button asChild size="sm">
                      <a href={listing.url} target="_blank" rel="noopener noreferrer" className="gap-2">
                        Ver
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
