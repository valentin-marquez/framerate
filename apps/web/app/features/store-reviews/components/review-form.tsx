import { useState } from "react";
import { useAuthStore } from "~/features/auth/store/auth";
import {
  type StoreReview,
  useCreateStoreReview,
  useUpdateStoreReview,
} from "~/features/store-reviews/services/store-reviews";
import { Button } from "~/shared/components/primitives/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/components/primitives/card";
import { Textarea } from "~/shared/components/primitives/textarea";
import { RatingStars } from "./rating-stars";

interface ReviewFormProps {
  storeSlug: string;
  existing?: StoreReview | null;
  onDone?: () => void;
}

const MAX_COMMENT = 2000;

/**
 * Formulario para crear/editar una reseña. Si `existing` está presente, modo edit.
 */
export function ReviewForm({ storeSlug, existing, onDone }: ReviewFormProps) {
  const user = useAuthStore((s) => s.user);
  const [rating, setRating] = useState<number>(existing?.rating ?? 0);
  const [comment, setComment] = useState<string>(existing?.comment ?? "");
  const [error, setError] = useState<string | null>(null);

  const createMut = useCreateStoreReview(storeSlug);
  const updateMut = useUpdateStoreReview(storeSlug);

  const submitting = createMut.isPending || updateMut.isPending;

  if (!user) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">Inicia sesión para dejar una reseña.</p>
        </CardContent>
      </Card>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (rating < 1 || rating > 5) {
      setError("Selecciona una calificación entre 1 y 5 estrellas.");
      return;
    }
    if (comment.length > MAX_COMMENT) {
      setError(`El comentario excede el máximo de ${MAX_COMMENT} caracteres.`);
      return;
    }

    try {
      if (existing) {
        await updateMut.mutateAsync({
          id: existing.id,
          payload: { rating, comment: comment.trim() || null },
        });
      } else {
        await createMut.mutateAsync({ rating, comment: comment.trim() || null });
      }
      onDone?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setError(msg);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{existing ? "Editar tu reseña" : "Escribir una reseña"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="review-rating" className="text-sm font-medium">
              Calificación
            </label>
            <div id="review-rating">
              <RatingStars value={rating} size="lg" onChange={setRating} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="review-comment" className="text-sm font-medium">
              Comentario (opcional)
            </label>
            <Textarea
              id="review-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Cuenta tu experiencia con esta tienda..."
              rows={4}
              maxLength={MAX_COMMENT}
            />
            <div className="text-right text-xs text-muted-foreground tabular-nums">
              {comment.length} / {MAX_COMMENT}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            {onDone && (
              <Button type="button" variant="secondary" onClick={() => onDone()} disabled={submitting}>
                Cancelar
              </Button>
            )}
            <Button type="submit" disabled={submitting || rating === 0}>
              {submitting ? "Guardando..." : existing ? "Actualizar" : "Publicar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
