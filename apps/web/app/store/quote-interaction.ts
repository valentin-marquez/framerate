import { create } from "zustand";
import { persist } from "zustand/middleware";

interface QuoteInteractionState {
  lastSelectedQuoteId: string | null;
  setLastSelectedQuoteId: (id: string | null) => void;
}

export const useQuoteInteractionStore = create<QuoteInteractionState>()(
  persist(
    (set) => ({
      lastSelectedQuoteId: null,
      setLastSelectedQuoteId: (id) => set({ lastSelectedQuoteId: id }),
    }),
    {
      name: "quote-interaction-storage",
    },
  ),
);
