import { type QuoteDetail, type QuoteItem, quoteTotals } from "@framerate/contracts";
import { useEffect, useRef, useState } from "react";
import { useRevalidator } from "react-router";
import { toast } from "sonner";
import { useUser } from "~/features/auth/hooks/useAuth";
import { QuoteActions } from "~/features/quote/components/quote-actions";
import { QuoteHeader } from "~/features/quote/components/quote-header";
import { QuoteItemsList } from "~/features/quote/components/quote-items-list";
import { useQuoteRemoveItem, useQuoteUpdateItem } from "~/features/quote/hooks/useQuotes";
import { quotesService } from "~/features/quote/services/quotes";
import { copyToClipboard, exportToExcel } from "~/features/quote/utils/quote-export";
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
  const [quote, setQuote] = useState(loaderData.quote);
  // Una navegación o una recarga trae otra versión desde el loader.
  useEffect(() => setQuote(loaderData.quote), [loaderData.quote]);
  const inFlight = useRef(0);
  const user = useUser();
  const revalidator = useRevalidator();
  const updateItem = useQuoteUpdateItem();
  const removeItem = useQuoteRemoveItem();
  const { t } = useTranslation();

  const isOwner = !!user && user.username === quote.author.username;

  /**
   * El cambio se ve al instante y la respuesta del servidor (que trae la cotización completa) lo confirma. Con
   * varios clics seguidos sólo cuenta la última respuesta, para que el número no retroceda; si algo falla se
   * vuelve a pedir la cotización.
   */
  const settle = (detail: QuoteDetail) => {
    inFlight.current -= 1;
    if (inFlight.current === 0) setQuote(detail);
  };
  const fail = (message: string) => {
    inFlight.current -= 1;
    toast.error(message);
    revalidator.revalidate();
  };
  const showItems = (items: QuoteItem[]) => setQuote((current) => ({ ...current, items, totals: quoteTotals(items) }));

  const handleChangeQuantity = (item: QuoteItem, quantity: number) => {
    showItems(quote.items.map((i) => (i.id === item.id ? { ...i, quantity } : i)));
    inFlight.current += 1;
    updateItem.mutate(
      { quoteId: quote.id, itemId: item.id, data: { quantity } },
      { onSuccess: settle, onError: () => fail(t("update_quantity_error")) },
    );
  };

  const handleRemove = (item: QuoteItem) => {
    showItems(quote.items.filter((i) => i.id !== item.id));
    inFlight.current += 1;
    removeItem.mutate(
      { quoteId: quote.id, itemId: item.id },
      {
        onSuccess: (detail) => {
          toast.success(t("product_removed"));
          settle(detail);
        },
        onError: () => fail(t("remove_product_error")),
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
        />

        {quote.items.length > 0 && (
          <QuoteActions
            onExportPDF={handleExportPDF}
            onExportExcel={() => exportToExcel(quote)}
            onCopyClipboard={() => copyToClipboard(quote)}
          />
        )}
      </div>
    </div>
  );
}
