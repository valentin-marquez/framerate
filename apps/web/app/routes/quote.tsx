import type { ValidationIssue } from "@framerate/db";
import { pdf } from "@react-pdf/renderer";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useRevalidator } from "react-router";
import { toast } from "sonner";
import { QuoteActions } from "~/components/quotes/quote-actions";
import { QuoteHeader } from "~/components/quotes/quote-header";
import { QuoteItemsList } from "~/components/quotes/quote-items-list";
import { QuotePDF } from "~/components/quotes/quote-pdf";
import { QuoteValidationStatus } from "~/components/quotes/quote-validation-status";
import { SearchDialog } from "~/components/search/search-dialog";
import { useTranslation } from "~/hooks/use-translation";
import { useUser } from "~/hooks/useAuth";
import {
  useAnalyzeBuild,
  useDeleteQuote,
  useQuoteAddItem,
  useQuoteRemoveItem,
  useQuoteUpdateItem,
} from "~/hooks/useQuotes";
import { requireAuth } from "~/lib/auth.server";
import { quotesService, type VirtualQuoteItem } from "~/services/quotes";
import { copyToClipboard, exportToExcel } from "~/utils/quote-export";
import { QUOTE_SLOTS } from "~/utils/slots";
import type { Route } from "./+types/quote";

export function meta({ data }: Route.MetaArgs) {
  if (!data || !data.quote) return [{ title: "Cotización no encontrada | Framerate" }];
  const { quote } = data;
  return [
    { title: `${quote.name} - Cotización PC Gamer | Framerate` },
    {
      name: "description",
      // TODO: Considerar agregar el nombre del usuario si la API lo retorna en el futuro
      content: `Cotización de PC "${quote.name}" con ${quote.items.length} componentes. Potencia estimada: ${quote.estimated_wattage}W. Verifica compatibilidad y cotiza en tiendas chilenas con Framerate.`,
    },
    { property: "og:title", content: `${quote.name} - Cotización PC` },
    { property: "og:description", content: `Configuración de PC personalizada. Revisa los componentes y precios.` },
    { property: "og:type", content: "article" },
    { property: "og:locale", content: "es_CL" },
    { name: "robots", content: "noindex, nofollow" }, // Por ahora no indexamos cotizaciones privadas hasta que la lógica de public/private esté 100% definida abierta
  ];
}

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
  const navigate = useNavigate();
  const removeItem = useQuoteRemoveItem();
  const updateItem = useQuoteUpdateItem();
  const addItem = useQuoteAddItem();
  const deleteQuote = useDeleteQuote();
  const analyzeBuild = useAnalyzeBuild();
  const { t } = useTranslation();

  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Optimistic UI for toasts
  const [lastQuote, setLastQuote] = useState(quote);
  const activeToastId = useRef<string | number | null>(null);

  useEffect(() => {
    if (activeToastId.current && quote !== lastQuote) {
      toast.success(t("product_removed"), { id: activeToastId.current });
      activeToastId.current = null;
    }
    setLastQuote(quote);
  }, [quote, lastQuote, t]);

  const [analysis, setAnalysis] = useState<{
    status: "valid" | "warning" | "incompatible" | "unknown";
    issues: ValidationIssue[];
    estimatedWattage: number | null;
  } | null>(null);

  // Initialize with quote data
  useEffect(() => {
    if (quote) {
      setAnalysis({
        status: quote.compatibility_status,
        estimatedWattage: quote.estimated_wattage,
        issues: quote.validation_errors || [],
      });
    }
  }, [quote]);

  const handleDeleteQuote = () => {
    deleteQuote.mutate(quote.id, {
      onSuccess: () => {
        toast.success(t("quote_deleted"));
        navigate("/profile");
      },
      onError: () => {
        toast.error(t("quote_delete_error"));
      },
    });
  };

  const handleAddProduct = (product: { id: string }) => {
    addItem.mutate(
      {
        quoteId: quote.id,
        data: { product_id: product.id, quantity: 1 },
      },
      {
        onSuccess: () => {
          setIsSearchOpen(false);
          toast.success(t("product_added_short"));
          revalidator.revalidate();
        },
        onError: () => {
          toast.error(t("product_add_error"));
        },
      },
    );
  };

  const handleCheckCompatibility = () => {
    const productIds = activeItems.map((item) => item.product?.id).filter((id): id is string => !!id);

    analyzeBuild.mutate(productIds, {
      onSuccess: (data) => {
        console.log("--- DEBUG FRONTEND ANALYSIS ---");
        console.log("Analysis Data:", data);
        setAnalysis({
          status: data.status,
          issues: data.issues,
          estimatedWattage: data.estimatedWattage,
        });
        toast.success(t("compatibility_checked"));
      },
      onError: (error) => {
        console.error("--- DEBUG FRONTEND ANALYSIS ERROR ---", error);
        toast.error(t("compatibility_check_error"));
      },
    });
  };

  const handleExportExcel = () => {
    const itemsToExport = activeItems.map((item) => ({ ...item, quantity: 1 }));
    exportToExcel(quote, itemsToExport);
  };

  const handleExportPDF = async () => {
    const itemsToExport = activeItems.map((item) => ({ ...item, quantity: 1 }));
    const blob = await pdf(<QuotePDF quote={quote} items={itemsToExport} />).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${quote.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyClipboard = async () => {
    const itemsToExport = activeItems.map((item) => ({ ...item, quantity: 1 }));
    await copyToClipboard(quote, itemsToExport);
  };

  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});

  const flattenedItems = useMemo<VirtualQuoteItem[]>(() => {
    return quote.items.flatMap((item): VirtualQuoteItem[] => {
      if (item.quantity > 1) {
        return Array.from({ length: item.quantity }).map((_, index) => ({
          ...item,
          virtualId: `${item.id}-${index}`,
          isVirtual: true,
          originalItem: item,
          indexInGroup: index,
        }));
      }
      return [{ ...item, virtualId: item.id, isVirtual: false }];
    });
  }, [quote.items]);

  // Initialize selection state for exclusive slots
  useEffect(() => {
    const newSelection = { ...selectedVariants };
    let hasChanges = false;

    QUOTE_SLOTS.filter((s) => s.type === "exclusive").forEach((slot) => {
      const slotItems = flattenedItems.filter((item) => slot.accepts.includes(item.product?.category?.slug as any));
      if (slotItems.length > 0) {
        const currentSelection = newSelection[slot.id];
        // Check if current selection is valid (exists in current items)
        const isValid = slotItems.some((i) => (i.originalItem?.id || i.id) === currentSelection);

        if (!currentSelection || !isValid) {
          // Default to first option
          newSelection[slot.id] = slotItems[0].originalItem?.id || slotItems[0].id;
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      setSelectedVariants(newSelection);
    }
  }, [flattenedItems, selectedVariants]);

  const activeItems = useMemo(() => {
    return flattenedItems.filter((item) => {
      const slot = QUOTE_SLOTS.find((s) => s.accepts.includes(item.product?.category?.slug as any));
      if (!slot) return true; // "Other" items are always active
      if (slot.type === "additive") return true;

      // Exclusive
      const selectedId = selectedVariants[slot.id];
      // If no selection yet (initial render), show first
      if (!selectedId) {
        // Fallback logic matches useEffect but for render safety
        const slotItems = flattenedItems.filter((i) => slot.accepts.includes(i.product?.category?.slug as any));
        if (
          slotItems.length > 0 &&
          (item.originalItem?.id || item.id) === (slotItems[0].originalItem?.id || slotItems[0].id)
        ) {
          return true;
        }
        return false;
      }
      return (item.originalItem?.id || item.id) === selectedId;
    });
  }, [flattenedItems, selectedVariants]);

  useEffect(() => {
    console.log("--- DEBUG QUOTE ---");
    console.log("Quote:", quote);
    console.log("Flattened Items:", flattenedItems);
    console.log("Selected Variants:", selectedVariants);
    console.log("Active Items:", activeItems);
  }, [quote, flattenedItems, selectedVariants, activeItems]);

  const handleRemove = (item: VirtualQuoteItem) => {
    const toastId = toast.loading(t("removing_product"));
    activeToastId.current = toastId;

    if (item.isVirtual && item.originalItem) {
      const newQuantity = item.originalItem.quantity - 1;
      updateItem.mutate(
        {
          quoteId: quote.id,
          itemId: item.originalItem.id,
          data: { quantity: newQuantity },
        },
        {
          onSuccess: () => {
            revalidator.revalidate();
          },
          onError: () => {
            toast.error(t("remove_product_error"), { id: toastId });
            activeToastId.current = null;
          },
        },
      );
    } else {
      removeItem.mutate(
        { quoteId: quote.id, itemId: item.id },
        {
          onSuccess: () => {
            revalidator.revalidate();
          },
          onError: () => {
            toast.error(t("remove_product_error"), { id: toastId });
            activeToastId.current = null;
          },
        },
      );
    }
  };

  const handleChangeStore = (item: VirtualQuoteItem, listingId: string | null) => {
    console.log("Changing store:", { itemId: item.id, listingId });
    if (item.isVirtual && item.originalItem) {
      const newQuantity = item.originalItem.quantity - 1;
      updateItem.mutate(
        {
          quoteId: quote.id,
          itemId: item.originalItem.id,
          data: { quantity: newQuantity },
        },
        {
          onSuccess: () => {
            addItem.mutate(
              {
                quoteId: quote.id,
                data: {
                  product_id: item.product.id || "",
                  quantity: 1,
                  listing_id: listingId || undefined,
                },
              },
              { onSuccess: () => revalidator.revalidate() },
            );
          },
        },
      );
    } else {
      updateItem.mutate(
        {
          quoteId: quote.id,
          itemId: item.id,
          data: { listing_id: listingId },
        },
        {
          onSuccess: () => revalidator.revalidate(),
          onError: (error) => {
            console.error("Failed to update item store:", error);
          },
        },
      );
    }
  };

  const totalNormal = activeItems.reduce((acc, item) => {
    if (!item.product) return acc;
    const price = item.selected_listing ? item.selected_listing.price_normal : item.product.prices?.normal || 0;
    return acc + (price || 0);
  }, 0);

  const totalCash = activeItems.reduce((acc, item) => {
    if (!item.product) return acc;
    const price = item.selected_listing ? item.selected_listing.price_cash : item.product.prices?.cash || 0;
    return acc + (price || 0);
  }, 0);

  const compatibilityStatus = analysis?.status || "unknown";
  const estimatedWattage = analysis?.estimatedWattage;
  const validationErrors = analysis?.issues || [];
  const isOwner = user?.id === quote.user_id;

  return (
    <div className="min-h-screen w-full bg-background p-4 md:p-8 flex justify-center">
      <div className="w-full max-w-6xl space-y-8">
        <QuoteHeader
          quoteName={quote.name}
          userName={user?.user_metadata?.name}
          updatedAt={quote.updated_at}
          compatibilityStatus={compatibilityStatus}
          estimatedWattage={estimatedWattage || 0}
        />

        <QuoteValidationStatus status={compatibilityStatus} issues={validationErrors} />

        <QuoteItemsList
          flattenedItems={flattenedItems}
          activeItems={activeItems}
          totalNormal={totalNormal}
          totalCash={totalCash}
          onRemove={handleRemove}
          onChangeStore={handleChangeStore}
          isOwner={isOwner}
          selectedVariants={selectedVariants}
          onSelectVariant={(slotId, itemId) => setSelectedVariants((prev) => ({ ...prev, [slotId]: itemId }))}
          onAdd={() => setIsSearchOpen(true)}
        />

        <QuoteActions
          onDelete={handleDeleteQuote}
          onExportPDF={handleExportPDF}
          onExportExcel={handleExportExcel}
          onCopyClipboard={handleCopyClipboard}
          onCheckCompatibility={handleCheckCompatibility}
          isDeleting={deleteQuote.isPending}
          isCheckingCompatibility={analyzeBuild.isPending}
        />
      </div>
      <SearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} onSelectProduct={handleAddProduct} />
    </div>
  );
}
