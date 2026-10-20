import {
  isAdditiveSlot,
  type Offer,
  type QuoteCondensePlan,
  type QuoteDetail,
  type QuoteItem,
  quoteTotals,
} from "@framerate/contracts";
import { useEffect, useRef, useState } from "react";
import { useRevalidator } from "react-router";
import { toast } from "sonner";
import { useUser } from "~/features/auth/hooks/useAuth";
import { QuoteActions } from "~/features/quote/components/quote-actions";
import { CompatibilityList } from "~/features/quote/components/quote-compatibility";
import { QuoteHeader } from "~/features/quote/components/quote-header";
import { QuoteItemsList } from "~/features/quote/components/quote-items-list";
import { QuoteLikeButton, useLikeHint } from "~/features/quote/components/quote-like-button";
import { QuoteOwnerBar } from "~/features/quote/components/quote-owner-bar";
import { QuoteTotals } from "~/features/quote/components/quote-totals";
import { useQuoteRemoveItem, useQuoteUpdateItem } from "~/features/quote/hooks/useQuotes";
import { quotesService } from "~/features/quote/services/quotes";
import { useQuoteInteractionStore } from "~/features/quote/store/quote-interaction";
import { copyToClipboard, exportToExcel } from "~/features/quote/utils/quote-export";
import { useTranslation } from "~/shared/hooks/use-translation";
import { formatCLP } from "~/shared/utils/format";
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
  // Ya se volvió a la cotización: la ficha deja de agregar directo a ella.
  useEffect(() => useQuoteInteractionStore.getState().setOriginQuote(null), []);
  const inFlight = useRef(0);
  const user = useUser();
  const revalidator = useRevalidator();
  const updateItem = useQuoteUpdateItem();
  const removeItem = useQuoteRemoveItem();
  const { t } = useTranslation();

  const isOwner = !!user && user.username === quote.author.username;
  const likeHint = useLikeHint(!!user, isOwner);

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
  /** Se ve al instante; si el servidor falla, vuelve como estaba. */
  const handleToggleLike = () => {
    const wasLiked = quote.likedByMe;
    const show = (likedByMe: boolean, likeCount: number) =>
      setQuote((current) => ({ ...current, likedByMe, likeCount }));
    show(!wasLiked, Math.max(0, quote.likeCount + (wasLiked ? -1 : 1)));
    (wasLiked ? quotesService.unlike(quote.id) : quotesService.like(quote.id)).then(
      (result) => show(result.likedByMe, result.likeCount),
      () => {
        show(wasLiked, quote.likeCount);
        toast.error(t("quote_like_error"));
      },
    );
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

  const handleSelect = (item: QuoteItem) => {
    showItems(
      quote.items.map((i) =>
        i.slot === item.slot && !isAdditiveSlot(i.slot) ? { ...i, isSelected: i.id === item.id } : i,
      ),
    );
    inFlight.current += 1;
    updateItem.mutate(
      { quoteId: quote.id, itemId: item.id, data: { isSelected: true } },
      { onSuccess: settle, onError: () => fail(t("quote_update_error")) },
    );
  };

  const handleChooseOffer = (item: QuoteItem, offer: Offer | null) => {
    // Al elegir una tienda se ve su precio ya; al volver al mejor precio hay que esperar al servidor.
    showItems(
      quote.items.map((i) =>
        i.id !== item.id
          ? i
          : {
              ...i,
              chosenListingId: offer?.id ?? null,
              offer: offer
                ? {
                    id: offer.id,
                    store: offer.store,
                    url: offer.url,
                    priceCash: offer.priceCash,
                    priceCard: offer.priceCard,
                  }
                : i.offer,
            },
      ),
    );
    inFlight.current += 1;
    updateItem.mutate(
      { quoteId: quote.id, itemId: item.id, data: { listingId: offer?.id ?? null } },
      { onSuccess: settle, onError: () => fail(t("quote_update_error")) },
    );
  };

  /**
   * Vuelve al mejor precio cada ítem con la tienda fijada a mano. Las respuestas de los PATCH en paralelo pueden llegar
   * en cualquier orden, así que al final se pide la cotización una vez y esa es la que cuenta.
   */
  const handleChooseCheapest = async () => {
    const pinned = quote.items.filter((i) => i.isSelected && i.chosenListingId !== null);
    if (pinned.length === 0) return;
    const before = quote.totals.cash;
    showItems(quote.items.map((i) => (pinned.includes(i) ? { ...i, chosenListingId: null } : i)));
    inFlight.current += 1;
    try {
      await Promise.all(
        pinned.map((i) => updateItem.mutateAsync({ quoteId: quote.id, itemId: i.id, data: { listingId: null } })),
      );
      const fresh = await quotesService.getById(quote.id);
      inFlight.current -= 1;
      if (inFlight.current === 0) setQuote(fresh);
      const saved = before - fresh.totals.cash;
      toast.success(saved > 0 ? t("quote_cheapest_saved", { amount: formatCLP(saved) }) : t("quote_cheapest_already"));
    } catch {
      fail(t("quote_update_error"));
    }
  };

  /**
   * Aplica el plan de comprar en menos tiendas: fija la oferta de cada ítem que cambia de tienda (el servidor ya
   * respetó el tope por ítem) y vuelve a pedir la cotización una vez, por el mismo motivo que arriba.
   */
  const handleCondense = async (plan: QuoteCondensePlan) => {
    const changes = plan.items.filter((p) => quote.items.find((i) => i.id === p.itemId)?.offer?.id !== p.listingId);
    inFlight.current += 1;
    try {
      await Promise.all(
        changes.map((p) =>
          updateItem.mutateAsync({ quoteId: quote.id, itemId: p.itemId, data: { listingId: p.listingId } }),
        ),
      );
      const fresh = await quotesService.getById(quote.id);
      inFlight.current -= 1;
      if (inFlight.current === 0) setQuote(fresh);
      toast.success(
        t(plan.storesAfter === 1 ? "quote_condense_done_one" : "quote_condense_done", {
          count: plan.storesAfter,
          extra: formatCLP(plan.extraCash),
        }),
      );
    } catch {
      fail(t("quote_update_error"));
    }
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
    <div className="min-h-screen w-full p-4 md:p-8 flex justify-center">
      <div className="w-full max-w-7xl space-y-8">
        <QuoteHeader quoteName={quote.name} author={quote.author} updatedAt={quote.updatedAt}>
          {quote.visibility === "public" && (
            <QuoteLikeButton
              liked={quote.likedByMe}
              count={quote.likeCount}
              disabled={!user || isOwner}
              hint={likeHint}
              onToggle={handleToggleLike}
            />
          )}
        </QuoteHeader>

        {isOwner && <QuoteOwnerBar quote={quote} onChange={setQuote} />}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
          <div className="min-w-0 lg:col-span-8">
            <QuoteItemsList
              quote={quote}
              isOwner={isOwner}
              onChangeQuantity={handleChangeQuantity}
              onRemove={handleRemove}
              onSelect={handleSelect}
              onChooseOffer={handleChooseOffer}
              onChooseCheapest={handleChooseCheapest}
              onCondense={handleCondense}
            />
          </div>

          <aside className="min-w-0 space-y-4 lg:col-span-4 lg:sticky lg:top-4">
            <QuoteTotals
              totalNormal={quote.totals.card}
              totalCash={quote.totals.cash}
              hasOutOfStockItems={quote.items.some((item) => item.isSelected && !item.offer)}
              compatibility={quote.compatibility}
            >
              {quote.items.length > 0 && (
                <QuoteActions
                  block
                  onExportPDF={handleExportPDF}
                  onExportExcel={() => exportToExcel(quote)}
                  onCopyClipboard={() => copyToClipboard(quote)}
                />
              )}
            </QuoteTotals>
            {quote.compatibility.checks.length > 0 && <CompatibilityList compatibility={quote.compatibility} />}
          </aside>
        </div>
      </div>
    </div>
  );
}
