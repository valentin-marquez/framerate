import {
  IconAlertTriangle,
  IconBolt,
  IconCheck,
  IconChevronDown,
  IconClipboard,
  IconDownload,
  IconFileTypeCsv,
  IconFileTypePdf,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { useRevalidator } from "react-router";
import { Button } from "~/components/primitives/button";
import { Dialog, DialogContent, DialogTrigger } from "~/components/primitives/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/primitives/dropdown-menu";
import { useUser } from "~/hooks/useAuth";
import { useQuoteRemoveItem } from "~/hooks/useQuotes";
import { requireAuth } from "~/lib/auth.server";
import { quotesService } from "~/services/quotes";
import { getCategoryConfig } from "~/utils/categories";
import { formatCLP } from "~/utils/format";
import type { Route } from "./+types/quote";

export async function loader({ params, request }: Route.LoaderArgs) {
  try {
    const { user, supabase } = await requireAuth(request);

    if (user.id === undefined) {
      throw new Response("Unauthorized", { status: 401 });
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      throw new Response("Unauthorized", { status: 401 });
    }

    const quote = await quotesService.getById(params.slug, token);
    return { quote };
  } catch (_error) {
    throw new Response("cotizacion no encontrada", { status: 404 });
  }
}

export default function QuoteRoute({ loaderData }: Route.ComponentProps) {
  const user = useUser();
  const quote = loaderData.quote;
  const revalidator = useRevalidator();
  const removeItem = useQuoteRemoveItem();

  const handleRemoveItem = (itemId: string) => {
    removeItem.mutate(
      { quoteId: quote.id, itemId },
      {
        onSuccess: () => {
          revalidator.revalidate();
        },
      },
    );
  };

  console.log(quote.items[0]);

  // Calculate total if not provided in totals object
  const totalNormal =
    quote.totals?.normal || quote.items.reduce((acc: number, item: any) => acc + (item.product.prices?.normal || 0), 0);
  const totalCash =
    quote.totals?.cash || quote.items.reduce((acc: number, item: any) => acc + (item.product.prices?.cash || 0), 0);

  const compatibilityStatus = quote.compatibility_status || "unknown";
  const estimatedWattage = quote.estimated_wattage;

  const getCompatibilityBadge = (status: string) => {
    switch (status) {
      case "valid":
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-sm font-medium border border-green-500/20">
            <IconCheck size={16} />
            <span>Compatible</span>
          </div>
        );
      case "warning":
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-sm font-medium border border-yellow-500/20">
            <IconAlertTriangle size={16} />
            <span>Advertencia</span>
          </div>
        );
      case "incompatible":
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-sm font-medium border border-red-500/20">
            <IconAlertTriangle size={16} />
            <span>Incompatible</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-muted-foreground text-sm font-medium border border-border/40">
            <IconRefresh size={16} />
            <span>Sin verificar</span>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen w-full bg-background p-4 md:p-8 flex justify-center">
      <div className="w-full max-w-5xl space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">{quote.name}</h1>
            <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="text-sm">Creado por</span>
                <span className="font-medium text-foreground">
                  {user?.user_metadata?.name ? user.user_metadata.name.slice(0, -2) : "Usuario"}
                </span>
              </div>
              <span className="text-border/40">|</span>
              <div className="flex items-center gap-2">
                <span className="text-sm">Actualizado</span>
                <span className="font-medium text-foreground">
                  {new Date(quote.updated_at).toLocaleDateString("es-CL")}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {getCompatibilityBadge(compatibilityStatus)}
            {estimatedWattage && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm font-medium border border-blue-500/20">
                <IconBolt size={16} />
                <span>{estimatedWattage}W est.</span>
              </div>
            )}
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-card rounded-3xl border border-border/40 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border/40 bg-secondary/5 flex justify-between items-center">
            <h2 className="text-xl font-semibold tracking-tight">Componentes</h2>
            <span className="text-sm text-muted-foreground">{quote.items.length} items</span>
          </div>

          <div className="divide-y divide-border/40">
            {quote.items.length > 0 ? (
              quote.items.map((item: any) => {
                const product = item.product;
                const selectedListing = item.selected_listing;

                // Determine prices based on selection or best available
                const price = selectedListing ? selectedListing.price_normal || 0 : product.prices?.normal || 0;

                const cashPrice = selectedListing ? selectedListing.price_cash || 0 : product.prices?.cash || 0;

                return (
                  <div
                    key={item.id}
                    className="group flex flex-col sm:flex-row sm:items-center gap-4 p-4 hover:bg-secondary/30 transition-colors duration-200"
                  >
                    {/* Image */}
                    <div className="h-16 w-16 shrink-0 rounded-lg bg-card p-1 border border-border/40 overflow-hidden flex items-center justify-center">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="h-full w-full object-contain" />
                      ) : (
                        <div className="h-full w-full bg-secondary/50" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                          {getCategoryConfig(product.category?.slug)?.label || "Componente"}
                        </span>
                        {product.brand?.name && (
                          <span className="text-xs text-muted-foreground">{product.brand.name}</span>
                        )}
                      </div>
                      <h3 className="font-medium text-foreground truncate pr-4">{product.name}</h3>

                      {/* Specs Summary */}
                      {product.specs && (
                        <p className="text-xs text-muted-foreground truncate">
                          {Object.entries(product.specs)
                            .slice(0, 3)
                            .map(([key, val]) => `${key}: ${val}`)
                            .join(" • ")}
                        </p>
                      )}

                      {/* Selected Store Info */}
                      {selectedListing && (
                        <div className="flex items-center gap-1.5 mt-1">
                          {selectedListing.store?.logo_url && (
                            <img
                              src={selectedListing.store.logo_url}
                              alt={selectedListing.store.name}
                              className="h-4 w-4 object-contain rounded-sm"
                            />
                          )}
                          <span className="text-xs text-muted-foreground">
                            Vendido por{" "}
                            <span className="font-medium text-foreground">{selectedListing.store?.name}</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Price */}
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span className="font-mono text-lg font-medium text-foreground">{formatCLP(price)}</span>
                      {cashPrice > 0 && cashPrice !== price && (
                        <span className="text-xs text-muted-foreground">Efectivo: {formatCLP(cashPrice)}</span>
                      )}
                      {!selectedListing && (
                        <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">Mejor precio</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center pl-2">
                      <Dialog>
                        <DialogTrigger>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveItem(item.id)}
                            disabled={removeItem.isPending}
                            title="Eliminar producto"
                          >
                            <IconTrash size={18} />
                          </Button>
                        </DialogTrigger>

                        <DialogContent>
                          <div className="p-6 space-y-4">
                            <h3 className="text-lg font-semibold text-foreground">Producto eliminado</h3>
                            <p className="text-sm text-muted-foreground">
                              El producto <span className="font-medium text-foreground">{product.name}</span> ha sido
                              eliminado de la cotización.
                            </p>
                            <Button
                              onClick={() => {
                                revalidator.revalidate();
                              }}
                            >
                              Cerrar
                            </Button>
                            <Button></Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-12 text-center flex flex-col items-center gap-3 text-muted-foreground">
                <div className="h-12 w-12 rounded-full bg-secondary/50 flex items-center justify-center">
                  <IconAlertTriangle className="opacity-50" />
                </div>
                <p>Esta cotización está vacía.</p>
                <Button variant="outline" size="sm">
                  Agregar componentes
                </Button>
              </div>
            )}
          </div>

          {/* Footer / Total */}
          <div className="bg-secondary/10 p-6 border-t border-border/40">
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Normal</span>
                <span className="text-xl font-semibold text-foreground">{formatCLP(totalNormal)}</span>
              </div>
              {totalCash > 0 && totalCash !== totalNormal && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Total Efectivo</span>
                  <span className="text-2xl font-bold tracking-tight text-green-600 dark:text-green-400">
                    {formatCLP(totalCash)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-end">
          <Button variant="secondary" className="gap-2">
            <IconRefresh size={18} />
            Chequear Compatibilidad
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button className="gap-2">
                <IconDownload size={18} />
                Guardar como
                <IconChevronDown size={16} className="opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <IconFileTypePdf size={16} />
                <span>PDF</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <IconFileTypeCsv size={16} />
                <span>CSV / Excel</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <IconClipboard size={16} />
                <span>Copiar al portapapeles</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
