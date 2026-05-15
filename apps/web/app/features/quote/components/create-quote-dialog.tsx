import { IconLoader2, IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useCreateQuote } from "~/features/quote/hooks/useQuotes";
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
import { Switch } from "~/shared/components/primitives/switch";
import { Textarea } from "~/shared/components/primitives/textarea";
import { useTranslation } from "~/shared/hooks/use-translation";

interface CreateQuoteDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: (quoteId: string) => void;
}

export function CreateQuoteDialog({ trigger, onSuccess }: CreateQuoteDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const createQuote = useCreateQuote();
  const { t } = useTranslation();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_public: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    createQuote.mutate(formData, {
      onSuccess: (newQuote) => {
        setIsOpen(false);
        setFormData({ name: "", description: "", is_public: false });

        // Delay de 600ms para permitir ver la animación de agregado en la lista
        setTimeout(() => {
          if (onSuccess) {
            onSuccess(newQuote.id);
          } else {
            navigate(`/cotizacion/${newQuote.id}`);
          }
        }, 600);
      },
      onError: (err) => {
        console.error("Error creating quote:", err);
        setError(err instanceof Error ? err.message : t("create_quote_error"));
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="default" className="gap-2">
            <IconPlus className="size-4" />
            {t("create_quote")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-106.25 bg-card">
        <DialogHeader>
          <DialogTitle>{t("create_new_quote_title")}</DialogTitle>
          <DialogDescription>{t("create_quote_desc")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          {error && <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md">{error}</div>}

          <div className="grid gap-2">
            <Label htmlFor="name" className="text-card-foreground/65">
              {t("name")}
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder={t("quote_name_placeholder")}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description" className="text-card-foreground/65">
              {t("description_optional")}
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder={t("quote_description_placeholder")}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="is_public"
              checked={formData.is_public}
              onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_public: checked }))}
            />
            <Label htmlFor="is_public" className="cursor-pointer text-card-foreground/65">
              {t("public_quote")}
            </Label>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="link" onClick={() => setIsOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={createQuote.isPending}>
              {createQuote.isPending && <IconLoader2 className="mr-2 size-4 animate-spin" />}
              {t("create_quote")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
