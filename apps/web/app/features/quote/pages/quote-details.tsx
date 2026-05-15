import type { PerformanceEstimation, ValidationIssue } from "@framerate/db";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useRevalidator } from "react-router";
import { toast } from "sonner";
import { useUser } from "~/features/auth/hooks/useAuth";
import { getAuthUser } from "~/features/auth/services/auth.server";
import { QuoteActions } from "~/features/quote/components/quote-actions";
import { QuoteHeader } from "~/features/quote/components/quote-header";
import { QuoteItemsList } from "~/features/quote/components/quote-items-list";
import { QuotePerformanceCard } from "~/features/quote/components/quote-performance-card";
import { QuoteValidationStatus } from "~/features/quote/components/quote-validation-status";
import {
  useAnalyzeQuote,
  useDeleteQuote,
  useQuoteAddItem,
  useQuoteRemoveItem,
  useQuoteUpdateItem,
} from "~/features/quote/hooks/useQuotes";
import { quotesService, type VirtualQuoteItem } from "~/features/quote/services/quotes";
import { copyToClipboard, exportToExcel } from "~/features/quote/utils/quote-export";
import { SearchDialog } from "~/features/search/components/search-dialog";
import { useTranslation } from "~/shared/hooks/use-translation";
import { QUOTE_SLOTS } from "~/shared/utils/slots";
import type { Route } from "./+types/quote-details";

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
    const { supabase } = await getAuthUser(request);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    const quote = await quotesService.getById(params.slug, token);
    return { quote };
  } catch (_error) {
    throw new Response("cotizacion no encontrada", { status: 404 });
  }
}

// react-doctor-disable-next-line no-giant-component -- breaking into focused components is a separate task, tracked
export default function QuoteRoute({ loaderData }: Route.ComponentProps) {
  const user = useUser();
  const quote = loaderData.quote;
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const removeItem = useQuoteRemoveItem();
  const updateItem = useQuoteUpdateItem();
  const addItem = useQuoteAddItem();
  const deleteQuote = useDeleteQuote();
  const analyzeQuote = useAnalyzeQuote();
  const { t } = useTranslation();

  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Optimistic UI for toasts — `lastQuote` sólo se compara dentro de un effect,
  // nunca se renderiza, así que usar useState provocaba re-renders innecesarios.
  const lastQuoteRef = useRef(quote);
  const activeToastId = useRef<string | number | null>(null);

  useEffect(() => {
    if (activeToastId.current && quote !== lastQuoteRef.current) {
      toast.success(t("product_removed"), { id: activeToastId.current });
      activeToastId.current = null;
    }
    lastQuoteRef.current = quote;
  }, [quote, t]);

  type AnalysisState = {
    status: "valid" | "warning" | "incompatible" | "unknown";
    issues: ValidationIssue[];
    estimatedWattage: number | null;
    performance: PerformanceEstimation | null;
    hasRun: boolean;
  };

  // Synchronous init from loader to avoid the "Sin verificar" flash on first paint.
  // hasRun reflects whether the cached analysis is meaningful (last_analyzed_at is set).
  const [analysis, setAnalysis] = useState<AnalysisState>(() => ({
    status: quote.compatibility_status,
    estimatedWattage: quote.estimated_wattage,
    issues: quote.validation_errors || [],
    performance: null,
    hasRun: !!quote.last_analyzed_at,
  }));

  // Re-sync when the loader returns a fresh quote (after revalidation).
  // We keep the in-memory `performance` since it isn't persisted server-side yet.
  const lastSyncedQuoteId = useRef(quote.id);
  const lastSyncedAnalyzedAt = useRef(quote.last_analyzed_at);
  useEffect(() => {
    if (quote.id !== lastSyncedQuoteId.current || quote.last_analyzed_at !== lastSyncedAnalyzedAt.current) {
      lastSyncedQuoteId.current = quote.id;
      lastSyncedAnalyzedAt.current = quote.last_analyzed_at;
      setAnalysis((prev) => ({
        ...prev,
        status: quote.compatibility_status,
        estimatedWattage: quote.estimated_wattage,
        issues: quote.validation_errors || [],
        hasRun: !!quote.last_analyzed_at,
      }));
    }
  }, [quote.id, quote.last_analyzed_at, quote.compatibility_status, quote.estimated_wattage, quote.validation_errors]);

  // ---------- Debounced auto-analyze ----------
  // Single shared debounce timer + "queued" flag so concurrent mutations only ever
  // schedule one analyze. If a re-analysis lands while another is already in flight,
  // we queue exactly one follow-up after it completes.
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reanalyzePending = useRef(false);
  const isAnalyzingRef = useRef(false);

  const runAnalyze = useCallback(() => {
    isAnalyzingRef.current = true;
    analyzeQuote.mutate(quote.id, {
      onSuccess: (data) => {
        setAnalysis({
          status: data.status,
          issues: data.issues,
          estimatedWattage: data.estimatedWattage,
          performance: data.performance ?? null,
          hasRun: true,
        });
        revalidator.revalidate();
      },
      onError: (error) => {
        console.error("auto-analyze failed", error);
      },
      onSettled: () => {
        isAnalyzingRef.current = false;
        // If something asked for another analyze while we were running, honor it now.
        if (reanalyzePending.current) {
          reanalyzePending.current = false;
          runAnalyze();
        }
      },
    });
  }, [analyzeQuote, quote.id, revalidator]);

  const scheduleAutoAnalyze = useCallback(() => {
    // If an analyze is already in flight, just mark a follow-up.
    if (isAnalyzingRef.current) {
      reanalyzePending.current = true;
      return;
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      runAnalyze();
    }, 1500);
  }, [runAnalyze]);

  // Cleanup pending timer on unmount.
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const cancelDebouncedAnalyze = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
  }, []);

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
          scheduleAutoAnalyze();
        },
        onError: () => {
          toast.error(t("product_add_error"));
        },
      },
    );
  };

  const handleCheckCompatibility = () => {
    // Manual click pre-empts any pending debounced analyze.
    cancelDebouncedAnalyze();
    reanalyzePending.current = false;
    isAnalyzingRef.current = true;
    analyzeQuote.mutate(quote.id, {
      onSuccess: (data) => {
        setAnalysis({
          status: data.status,
          issues: data.issues,
          estimatedWattage: data.estimatedWattage,
          performance: data.performance ?? null,
          hasRun: true,
        });
        revalidator.revalidate();
        toast.success(t("compatibility_checked"));
      },
      onError: (error) => {
        console.error("compatibility check failed", error);
        toast.error(t("compatibility_check_error"));
      },
      onSettled: () => {
        isAnalyzingRef.current = false;
      },
    });
  };

  const handleExportExcel = () => {
    const itemsToExport = activeItems.map((item) => ({ ...item, quantity: 1 }));
    exportToExcel(quote, itemsToExport);
  };

  const handleExportPDF = async () => {
    const [{ pdf }, { QuotePDF }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("~/features/quote/components/quote-pdf"),
    ]);
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

    for (const slot of QUOTE_SLOTS) {
      if (slot.type !== "exclusive") continue;
      const slotItems = flattenedItems.filter((item) => slot.accepts.includes(item.product?.category?.slug ?? ""));
      if (slotItems.length === 0) continue;

      const currentSelection = newSelection[slot.id];
      // Check if current selection is valid (exists in current items)
      const isValid = slotItems.some((i) => (i.originalItem?.id || i.id) === currentSelection);

      if (!currentSelection || !isValid) {
        // Default to first option
        newSelection[slot.id] = slotItems[0].originalItem?.id || slotItems[0].id;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      setSelectedVariants(newSelection);
    }
  }, [flattenedItems, selectedVariants]);

  const activeItems = useMemo(() => {
    return flattenedItems.filter((item) => {
      const slot = QUOTE_SLOTS.find((s) => s.accepts.includes(item.product?.category?.slug ?? ""));
      if (!slot) return true; // "Other" items are always active
      if (slot.type === "additive") return true;

      // Exclusive
      const selectedId = selectedVariants[slot.id];
      // If no selection yet (initial render), show first
      if (!selectedId) {
        // Fallback logic matches useEffect but for render safety
        const slotItems = flattenedItems.filter((i) => slot.accepts.includes(i.product?.category?.slug ?? ""));
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
            scheduleAutoAnalyze();
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
            scheduleAutoAnalyze();
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
              {
                onSuccess: () => {
                  revalidator.revalidate();
                  scheduleAutoAnalyze();
                },
              },
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
          onSuccess: () => {
            revalidator.revalidate();
            scheduleAutoAnalyze();
          },
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

  const hasItems = quote.items.length > 0;
  // If we've never analyzed and have no items, surface "unknown" without items will hide
  // the badge through QuoteValidationStatus, but the header still renders one.
  // Spec: empty + never analyzed -> show nothing/"Vacía" via the header.
  const compatibilityStatus = analysis.hasRun || hasItems ? analysis.status : "empty";
  const estimatedWattage = analysis.estimatedWattage;
  const validationErrors = analysis.issues || [];
  const performance = analysis.performance;
  const isAnalyzing = analyzeQuote.isPending;
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
          isAnalyzing={isAnalyzing}
        />

        {performance && <QuotePerformanceCard performance={performance} />}

        <QuoteValidationStatus status={analysis.status} issues={validationErrors} />

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
          onAdd={isOwner ? () => setIsSearchOpen(true) : undefined}
        />

        {isOwner && (
          <QuoteActions
            onDelete={handleDeleteQuote}
            onExportPDF={handleExportPDF}
            onExportExcel={handleExportExcel}
            onCopyClipboard={handleCopyClipboard}
            onCheckCompatibility={handleCheckCompatibility}
            isDeleting={deleteQuote.isPending}
            isCheckingCompatibility={analyzeQuote.isPending}
          />
        )}
      </div>
      {isOwner && (
        <SearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} onSelectProduct={handleAddProduct} />
      )}
    </div>
  );
}
