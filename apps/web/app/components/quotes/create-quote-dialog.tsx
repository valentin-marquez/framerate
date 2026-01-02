import { IconLoader2, IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "~/components/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/primitives/dialog";
import { Input } from "~/components/primitives/input";
import { Label } from "~/components/primitives/label";
import { Textarea } from "~/components/primitives/textarea";
import { useCreateQuote } from "~/hooks/useQuotes";
import { Switch } from "../primitives/switch";

interface CreateQuoteDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: (quoteId: string) => void;
}

export function CreateQuoteDialog({ trigger, onSuccess }: CreateQuoteDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const createQuote = useCreateQuote();

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

        if (onSuccess) {
          onSuccess(newQuote.id);
        } else {
          navigate(`/cotizacion/${newQuote.id}`);
        }
      },
      onError: (err) => {
        console.error("Error creating quote:", err);
        setError(err instanceof Error ? err.message : "Error al crear la cotización");
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger>
        {trigger || (
          <Button variant="secondary" className="gap-2">
            <IconPlus className="h-4 w-4" />
            Crear Cotización
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-106.25 bg-card">
        <DialogHeader>
          <DialogTitle>Crear nueva cotización</DialogTitle>
          <DialogDescription>Dale un nombre a tu proyecto para empezar a agregar componentes.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          {error && <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md">{error}</div>}

          <div className="grid gap-2">
            <Label htmlFor="name" className="text-card-foreground/65">
              Nombre
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: PC Gamer 2026"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description" className="text-card-foreground/65">
              Descripción (Opcional)
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Para qué usarás este PC..."
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="is_public"
              checked={formData.is_public}
              onCheckedChange={(checked) => setFormData({ ...formData, is_public: checked })}
            />
            <Label htmlFor="is_public" className="cursor-pointer text-card-foreground/65">
              Cotizacion pública
            </Label>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button variant={"secondary"} type="submit" disabled={createQuote.isPending}>
              {createQuote.isPending && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Cotización
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
