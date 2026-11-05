import { IconHandStop, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Button } from "~/shared/components/primitives/button";
import { dismissPrompt, promptDismissed } from "../hand-storage";
import { MouseFitDialog } from "./mouse-fit-dialog";

const TITLE = "¿Qué mouse te queda?";

/**
 * Invitación a medir la mano en la categoría de mouses. `card` va sobre los filtros del riel y `line`, en teléfono,
 * donde los filtros viven en una hoja. Cerrada, queda un acceso chico: el aviso se va, la herramienta no.
 */
export function MouseFitPrompt({ variant }: { variant: "card" | "line" }) {
  // Hasta montar no se sabe qué guardó el navegador; el servidor no dibuja nada para no parpadear.
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => setDismissed(promptDismissed()), []);
  if (dismissed === null) return null;

  const close = () => {
    dismissPrompt();
    setDismissed(true);
  };
  const toggle = (next: boolean) => {
    setOpen(next);
    if (!next) setDismissed(promptDismissed());
  };
  const dialog = <MouseFitDialog open={open} onOpenChange={toggle} />;

  if (dismissed || variant === "line") {
    return (
      <>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={variant === "line" ? "w-full" : "w-full justify-start"}
          onClick={() => setOpen(true)}
        >
          <IconHandStop className="size-4" /> {dismissed ? "Medir mi mano" : TITLE}
        </Button>
        {dialog}
      </>
    );
  }

  return (
    <>
      <div className="flex shrink-0 flex-col gap-2 rounded-2xl border border-border/60 bg-card/70 p-3">
        <div className="flex items-start justify-between gap-2">
          <IconHandStop className="size-5 text-muted-foreground" />
          <button
            type="button"
            aria-label="Cerrar aviso"
            className="rounded-full p-1 text-muted-foreground hover:text-foreground"
            onClick={close}
          >
            <IconX className="size-4" />
          </button>
        </div>
        <p className="font-medium text-sm">{TITLE}</p>
        <p className="text-muted-foreground text-xs">Mide tu mano y te mostramos los que calzan con tu agarre.</p>
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          Medir mi mano
        </Button>
      </div>
      {dialog}
    </>
  );
}
