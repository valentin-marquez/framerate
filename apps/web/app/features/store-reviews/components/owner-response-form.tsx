import { useState } from "react";
import { type StoreReview, useUpdateStoreReview } from "~/features/store-reviews/services/store-reviews";
import { Button } from "~/shared/components/primitives/button";
import { Textarea } from "~/shared/components/primitives/textarea";

interface OwnerResponseFormProps {
  storeSlug: string;
  review: StoreReview;
  onDone?: () => void;
}

const MAX_RESPONSE = 1000;

/**
 * Formulario para que un store owner/editor responda públicamente a una reseña.
 */
export function OwnerResponseForm({ storeSlug, review, onDone }: OwnerResponseFormProps) {
  const [text, setText] = useState<string>(review.owner_response ?? "");
  const [error, setError] = useState<string | null>(null);
  const updateMut = useUpdateStoreReview(storeSlug);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = text.trim();
    if (trimmed.length > MAX_RESPONSE) {
      setError(`La respuesta excede los ${MAX_RESPONSE} caracteres.`);
      return;
    }

    try {
      await updateMut.mutateAsync({
        id: review.id,
        payload: { owner_response: trimmed || null },
      });
      onDone?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setError(msg);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="text-xs font-medium text-primary">Responder como tienda</div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Escribe una respuesta visible públicamente..."
        rows={3}
        maxLength={MAX_RESPONSE}
      />
      <div className="text-right text-xs text-muted-foreground tabular-nums">
        {text.length} / {MAX_RESPONSE}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        {onDone && (
          <Button type="button" variant="secondary" size="sm" onClick={() => onDone()} disabled={updateMut.isPending}>
            Cancelar
          </Button>
        )}
        <Button type="submit" size="sm" disabled={updateMut.isPending}>
          {updateMut.isPending ? "Guardando..." : review.owner_response ? "Actualizar" : "Publicar"}
        </Button>
      </div>
    </form>
  );
}
