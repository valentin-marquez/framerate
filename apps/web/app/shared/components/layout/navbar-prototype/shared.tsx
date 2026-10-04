// PROTOTIPO (#108): piezas mínimas que repiten las tres variantes.
import { IconPlus } from "@tabler/icons-react";
import { Link } from "react-router";
import { useUser } from "~/features/auth/hooks/useAuth";
import { CreateQuoteDialog } from "~/features/quote/components/create-quote-dialog";
import { cn } from "~/shared/lib/utils";
import { Logo } from "../logo";

export function Brand({ className }: { className?: string }) {
  return (
    <Link to="/" prefetch="intent" className={cn("flex shrink-0 items-center gap-2 text-foreground", className)}>
      <Logo className="size-6" />
      <span className="font-semibold text-lg tracking-tight">framerate</span>
    </Link>
  );
}

/** Cotizar: la otra tarea central del sitio, además de buscar. Sin sesión no se muestra (pide cuenta). */
export function QuoteAction({ className, label = "Cotizar" }: { className?: string; label?: string }) {
  const user = useUser();
  if (!user) return null;
  return (
    <CreateQuoteDialog
      trigger={
        <button
          type="button"
          className={cn(
            "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-foreground px-3.5 font-medium text-background text-sm transition-opacity hover:opacity-85",
            className,
          )}
        >
          <IconPlus className="size-4" stroke={2.25} />
          {label}
        </button>
      }
    />
  );
}

/** Pie del panel de sugerencias: los atajos, sólo con teclado físico. */
export function KeyHints() {
  return (
    <div className="hidden items-center gap-4 border-border/60 border-t px-4 py-2 text-[11px] text-muted-foreground md:flex">
      <span>
        <kbd className="font-mono">↑↓</kbd> moverse
      </span>
      <span>
        <kbd className="font-mono">Enter</kbd> abrir
      </span>
      <span>
        <kbd className="font-mono">Esc</kbd> cerrar
      </span>
    </div>
  );
}
