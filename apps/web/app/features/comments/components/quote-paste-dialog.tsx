import { IconLock, IconLockOpen } from "@tabler/icons-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useUser } from "~/features/auth/hooks/useAuth";
import { findQuoteUrls } from "~/features/comments/lib/quote-url";
import { useUpdateQuote } from "~/features/quote/hooks/useQuotes";
import { quotesService } from "~/features/quote/services/quotes";
import { Button } from "~/shared/components/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/shared/components/primitives/dialog";

// ponytail: hacer pública una cotización necesita PATCH /v1/quotes/:id, que llega con la entrega 2 de #25. Hasta entonces
// el aviso queda apagado para no llamar a una ruta que no existe.
const PASTE_PROMPT_ENABLED = false;

interface PendingQuote {
  id: string;
  name: string;
}

interface QuotePasteDialogState {
  pending: PendingQuote | null;
  queue: PendingQuote[];
  /** quoteIds we've already prompted for in this session — don't ask twice. */
  asked: Set<string>;
}

/**
 * Hook for the comment textarea: detects pasted private quote URLs owned by
 * the current user and offers a one-tap "make public" upgrade. Quotes the user
 * doesn't own (or that are 404) are left untouched — they'll fall back to
 * plain links at render time.
 */
export function useQuotePasteWatcher() {
  const user = useUser();
  const publish = useUpdateQuote();

  const [state, setState] = useState<QuotePasteDialogState>(() => ({
    pending: null,
    queue: [],
    asked: new Set<string>(),
  }));

  const close = useCallback(() => {
    setState((prev) => {
      const [next, ...rest] = prev.queue;
      return { pending: next ?? null, queue: rest, asked: prev.asked };
    });
  }, []);

  const handlePasteText = useCallback(
    async (text: string) => {
      if (!user || !PASTE_PROMPT_ENABLED) return;
      if (!text) return;
      const hits = findQuoteUrls(text);
      if (hits.length === 0) return;

      const seen = new Set<string>();
      const toQueue: PendingQuote[] = [];

      for (const hit of hits) {
        if (seen.has(hit.quoteId)) continue;
        seen.add(hit.quoteId);
        if (state.asked.has(hit.quoteId)) continue;
        try {
          const quote = await quotesService.getById(hit.quoteId);
          if (quote.author.username === user.username && quote.visibility === "private") {
            toQueue.push({ id: hit.quoteId, name: quote.name });
          }
        } catch {
          // 403/404 — not the user's, can't act. Leave it alone.
        }
      }

      if (toQueue.length === 0) return;

      setState((prev) => {
        const newAsked = new Set(prev.asked);
        for (const q of toQueue) newAsked.add(q.id);
        if (prev.pending) {
          return { pending: prev.pending, queue: [...prev.queue, ...toQueue], asked: newAsked };
        }
        const [first, ...rest] = toQueue;
        return { pending: first, queue: rest, asked: newAsked };
      });
    },
    [user, state.asked],
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLElement>) => handlePasteText(event.clipboardData.getData("text")),
    [handlePasteText],
  );

  const confirm = useCallback(async () => {
    const pending = state.pending;
    if (!pending) return;
    try {
      await publish.mutateAsync({ id: pending.id, data: { visibility: "public" } });
      toast.success(`"${pending.name}" ahora es pública`);
    } catch {
      toast.error("No se pudo cambiar la visibilidad de la cotización");
    } finally {
      close();
    }
  }, [state.pending, publish, close]);

  const node = (
    <Dialog
      open={state.pending !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="sm:max-w-md bg-card">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <IconLock className="size-4" />
            Cotización privada detectada
          </DialogTitle>
          <DialogDescription>
            Pegaste un link a <span className="font-medium">"{state.pending?.name}"</span>, que es privada. Para que
            otros usuarios la vean como una tarjeta en tu comentario, primero hay que hacerla pública.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={close} disabled={publish.isPending}>
            Mantener privada
          </Button>
          <Button onClick={confirm} disabled={publish.isPending} className="gap-1.5">
            <IconLockOpen className="size-4" />
            {publish.isPending ? "Publicando…" : "Hacer pública"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { handlePaste, handlePasteText, node };
}
