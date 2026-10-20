import { QUOTE_VISIBILITIES, type QuoteDetail, type QuoteVisibility } from "@framerate/contracts";
import { IconLoader2, IconPencil, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useDeleteQuote, useUpdateQuote } from "~/features/quote/hooks/useQuotes";
import { Button } from "~/shared/components/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/shared/components/primitives/dialog";
import { Input } from "~/shared/components/primitives/input";
import { Label } from "~/shared/components/primitives/label";
import { Textarea } from "~/shared/components/primitives/textarea";
import { useTranslation } from "~/shared/hooks/use-translation";
import { cn } from "~/shared/lib/utils";

interface QuoteOwnerBarProps {
  quote: QuoteDetail;
  /** La cotización con el cambio: se muestra al instante y se reemplaza por la respuesta del servidor. */
  onChange: (quote: QuoteDetail) => void;
}

/** Lo que sólo ve el dueño: quién puede ver la cotización, editarla y borrarla. El enlace se copia con Compartir. */
export function QuoteOwnerBar({ quote, onChange }: QuoteOwnerBarProps) {
  const { t } = useTranslation();
  const update = useUpdateQuote();

  const changeVisibility = (visibility: QuoteVisibility) => {
    if (visibility === quote.visibility) return;
    const previous = quote;
    onChange({ ...quote, visibility });
    update.mutate(
      { id: quote.id, data: { visibility } },
      {
        onSuccess: onChange,
        onError: () => {
          onChange(previous);
          toast.error(t("quote_update_error"));
        },
      },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <fieldset className="inline-flex rounded-xl bg-secondary/50 p-1">
          <legend className="sr-only">{t("quote_visibility")}</legend>
          {QUOTE_VISIBILITIES.map((visibility) => (
            <button
              key={visibility}
              type="button"
              aria-pressed={quote.visibility === visibility}
              onClick={() => changeVisibility(visibility)}
              className={cn(
                "cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                quote.visibility === visibility
                  ? "bg-card text-foreground shadow-sm dark:bg-secondary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`quote_visibility_${visibility}`)}
            </button>
          ))}
        </fieldset>

        <div className="ml-auto flex items-center gap-2">
          <EditQuoteDialog quote={quote} onChange={onChange} />
          <DeleteQuoteDialog quote={quote} />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{t(`quote_visibility_hint_${quote.visibility}`)}</p>
    </div>
  );
}

function EditQuoteDialog({ quote, onChange }: QuoteOwnerBarProps) {
  const { t } = useTranslation();
  const update = useUpdateQuote();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(quote.name);
  const [description, setDescription] = useState(quote.description ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate(
      { id: quote.id, data: { name, description } },
      {
        onSuccess: (detail) => {
          onChange(detail);
          setOpen(false);
        },
        onError: () => toast.error(t("quote_update_error")),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setName(quote.name);
          setDescription(quote.description ?? "");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <IconPencil className="size-4" />
          {t("edit_quote")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card">
        <DialogHeader>
          <DialogTitle>{t("edit_quote_title")}</DialogTitle>
          <DialogDescription>{t("edit_quote_desc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="quote-name" className="text-card-foreground/65">
              {t("name")}
            </Label>
            <Input id="quote-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quote-description" className="text-card-foreground/65">
              {t("description_optional")}
            </Label>
            <Textarea
              id="quote-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="link" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={update.isPending || name.trim() === ""}>
              {update.isPending && <IconLoader2 className="size-4 animate-spin" />}
              {t("save_changes")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteQuoteDialog({ quote }: { quote: QuoteDetail }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const remove = useDeleteQuote();
  const [open, setOpen] = useState(false);

  const confirm = () =>
    remove.mutate(quote.id, {
      onSuccess: () => {
        toast.success(t("quote_deleted"));
        navigate("/perfil");
      },
      onError: () => toast.error(t("quote_delete_error")),
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" className="gap-2">
          <IconTrash className="size-4" />
          {t("delete_quote")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card">
        <DialogHeader>
          <DialogTitle>{t("delete_quote_title")}</DialogTitle>
          <DialogDescription>{t("delete_quote_desc")}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="link" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button type="button" variant="destructive" disabled={remove.isPending} onClick={confirm}>
            {remove.isPending && <IconLoader2 className="size-4 animate-spin" />}
            {t("delete_quote")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
