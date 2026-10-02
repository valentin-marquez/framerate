import { IconArrowRight, IconSearch } from "@tabler/icons-react";
import { Form } from "react-router";
import { cn } from "~/shared/lib/utils";

/** Buscador del sitio (hero de la home y navbar). Es un formulario GET a /explorar: funciona antes de hidratar. */
export function SiteSearch({ id, className }: { id: string; className?: string }) {
  return (
    <Form
      action="/explorar"
      role="search"
      className={cn(
        "relative flex items-center overflow-hidden border border-border/60 bg-card shadow-sm transition-colors focus-within:border-primary",
        className,
      )}
    >
      <IconSearch className="pointer-events-none absolute left-4 size-[18px] text-muted-foreground" />
      <input
        id={id}
        type="search"
        name="search"
        placeholder="¿Qué componente buscas? Ej: RTX 4070, Ryzen 7…"
        aria-label="Buscar productos"
        // 16 px en móvil: con menos, iOS hace zoom al enfocar.
        className="size-full bg-transparent pr-12 pl-12 text-base text-secondary-foreground outline-none placeholder:text-muted-foreground md:text-[15px]"
      />
      <button
        type="submit"
        aria-label="Buscar"
        className="absolute right-2 flex size-7 items-center justify-center rounded-lg bg-secondary/40 text-secondary-foreground/70 transition-colors hover:bg-primary hover:text-primary-foreground"
      >
        <IconArrowRight className="size-4" />
      </button>
    </Form>
  );
}
