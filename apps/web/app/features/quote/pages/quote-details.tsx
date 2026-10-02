import type { QuoteItem } from "@framerate/contracts";
import { useState } from "react";
import { useRevalidator } from "react-router";
import { toast } from "sonner";
import { useUser } from "~/features/auth/hooks/useAuth";
import { QuoteActions } from "~/features/quote/components/quote-actions";
import { QuoteHeader } from "~/features/quote/components/quote-header";
import { QuoteItemsList } from "~/features/quote/components/quote-items-list";
import { useQuoteAddItem, useQuoteRemoveItem, useQuoteUpdateItem } from "~/features/quote/hooks/useQuotes";
import { quotesService } from "~/features/quote/services/quotes";
import { copyToClipboard, exportToExcel } from "~/features/quote/utils/quote-export";
import { SearchDialog } from "~/features/search/components/search-dialog";
import { useTranslation } from "~/shared/hooks/use-translation";
import type { Route } from "./+types/quote-details";

export function meta({ data }: Route.MetaArgs) {
  if (!data || !data.quote) return [{ title: "Cotización no encontrada - Framerate" }];
  const { quote } = data;
  return [
    { title: `${quote.name}: cotización de PC - Framerate` },
    {
      name: "description",
      content: `Cotización de PC "${quote.name}" de ${quote.author.displayName} con ${quote.itemCount} componentes. Revisa los precios en tiendas chilenas con Framerate.`,
    },
    { property: "og:title", content: `${quote.name}: cotización de PC` },
    { property: "og:description", content: `Configuración de PC personalizada. Revisa los componentes y precios.` },
    { property: "og:type", content: "article" },
    { property: "og:locale", content: "es_CL" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  try {
    return { quote: await quotesService.getById(params.slug) };
  } catch (_error) {
    throw new Response("cotizacion no encontrada", { status: 404 });
  }
}

export default function QuoteRoute({ loaderData }: Route.ComponentProps) {
  const { quote } = loaderData;
  const user = useUser();
  const revalidator = useRevalidator();
  const addItem = useQuoteAddItem();
  const updateItem = useQuoteUpdateItem();
  const removeItem = useQuoteRemoveItem();
  const { t } = useTranslation();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const isOwner = !!user && user.username === quote.author.username;

  const handleAddProduct = (product: { id: number }) => {
    addItem.mutate(
      { quoteId: quote.id, data: { productId: product.id, quantity: 1 } },
      {
        onSuccess: () => {
          setIsSearchOpen(false);
          toast.success(t("product_added_short"));
          revalidator.revalidate();
        },
        onError: () => toast.error(t("product_add_error")),
      },
    );
  };

  const handleChangeQuantity = (item: QuoteItem, quantity: number) => {
    updateItem.mutate(
      { quoteId: quote.id, itemId: item.id, data: { quantity } },
      { onSuccess: () => revalidator.revalidate(), onError: () => toast.error(t("update_quantity_error")) },
    );
  };

  const handleRemove = (item: QuoteItem) => {
    removeItem.mutate(
      { quoteId: quote.id, itemId: item.id },
      {
        onSuccess: () => {
          toast.success(t("product_removed"));
          revalidator.revalidate();
        },
        onError: () => toast.error(t("remove_product_error")),
      },
    );
  };

  const handleExportPDF = async () => {
    const [{ pdf }, { QuotePDF }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("~/features/quote/components/quote-pdf"),
    ]);
    const blob = await pdf(<QuotePDF quote={quote} />).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${quote.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen w-full bg-background p-4 md:p-8 flex justify-center">
      <div className="w-full max-w-6xl space-y-8">
        <QuoteHeader quoteName={quote.name} author={quote.author} updatedAt={quote.updatedAt} />

        <QuoteItemsList
          quote={quote}
          isOwner={isOwner}
          onChangeQuantity={handleChangeQuantity}
          onRemove={handleRemove}
          onAdd={isOwner ? () => setIsSearchOpen(true) : undefined}
        />

        {quote.items.length > 0 && (
          <QuoteActions
            onExportPDF={handleExportPDF}
            onExportExcel={() => exportToExcel(quote)}
            onCopyClipboard={() => copyToClipboard(quote)}
          />
        )}
      </div>
      {isOwner && (
        <SearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} onSelectProduct={handleAddProduct} />
      )}
    </div>
  );
}
