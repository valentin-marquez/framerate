import { create } from "zustand";
import { persist } from "zustand/middleware";

interface QuoteInteractionState {
  lastSelectedQuoteId: string | null;
  setLastSelectedQuoteId: (id: string | null) => void;
  /** Cotización desde la que se salió a buscar un producto; sólo en memoria, para que un reload la olvide. */
  originQuote: { id: string; name: string } | null;
  setOriginQuote: (quote: { id: string; name: string } | null) => void;
}

export const useQuoteInteractionStore = create<QuoteInteractionState>()(
  persist(
    (set) => ({
      lastSelectedQuoteId: null,
      setLastSelectedQuoteId: (id) => set({ lastSelectedQuoteId: id }),
      originQuote: null,
      setOriginQuote: (originQuote) => set({ originQuote }),
    }),
    {
      name: "quote-interaction-storage",
      partialize: (s) => ({ lastSelectedQuoteId: s.lastSelectedQuoteId }),
    },
  ),
);
