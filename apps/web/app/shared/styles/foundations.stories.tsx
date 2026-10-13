import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useRef, useState } from "react";
import { cn } from "~/shared/lib/utils";

/** Tokens del sistema: lo que se ajusta en `app.css` se ve reflejado aquí (y en todo el sitio). */
const meta = { title: "Fundamentos/Tokens" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const SURFACES = [
  ["background", "bg-background", "Fondo de la página"],
  ["card", "bg-card", "Tarjetas y superficies"],
  ["secondary", "bg-secondary", "Controles dentro de superficies"],
  ["muted", "bg-muted", "Rellenos suaves"],
  ["primary", "bg-primary", "Acción principal"],
  ["popover", "bg-popover", "Menús flotantes"],
  ["destructive", "bg-destructive", "Peligro"],
] as const;

const Swatch = ({ name, className, note }: { name: string; className: string; note: string }) => (
  <div className="space-y-2">
    <div className={cn("h-16 rounded-2xl border border-border", className)} />
    <div>
      <p className="font-medium text-foreground text-sm">{name}</p>
      <p className="text-muted-foreground text-xs">{note}</p>
    </div>
  </div>
);

export const Colores: Story = {
  render: () => (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {SURFACES.map(([name, className, note]) => (
          <Swatch key={name} name={name} className={className} note={note} />
        ))}
      </div>
      <div className="space-y-2">
        <p className="font-medium text-foreground text-sm">Texto</p>
        <p className="text-foreground">foreground — títulos y contenido</p>
        <p className="text-muted-foreground">muted-foreground — texto secundario</p>
        <p className="text-secondary-foreground">secondary-foreground — texto en controles</p>
        <p className="text-primary">primary — énfasis y enlaces</p>
      </div>
    </div>
  ),
};

const TYPE_GROUPS = [
  ["Title", ["text-title-h1", "text-title-h2", "text-title-h3", "text-title-h4", "text-title-h5", "text-title-h6"]],
  ["Label", ["text-label-xl", "text-label-lg", "text-label-md", "text-label-sm", "text-label-xs"]],
  [
    "Paragraph",
    ["text-paragraph-xl", "text-paragraph-lg", "text-paragraph-md", "text-paragraph-sm", "text-paragraph-xs"],
  ],
  ["Subheading", ["text-subheading-md", "text-subheading-sm", "text-subheading-xs", "text-subheading-2xs"]],
  ["Doc", ["text-doc-label", "text-doc-paragraph"]],
] as const;

/** Lee los valores ya aplicados, así la historia no repite lo que dice app.css. */
function TypeRow({ style }: { style: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [spec, setSpec] = useState("");
  useEffect(() => {
    if (!ref.current) return;
    const c = getComputedStyle(ref.current);
    const size = Number.parseFloat(c.fontSize);
    const tracking = Math.round(((Number.parseFloat(c.letterSpacing) || 0) / size) * 1000) / 10;
    setSpec(`${c.fontWeight} ${size}/${Number.parseFloat(c.lineHeight)} ${tracking}%`);
  }, []);
  return (
    <div className="grid gap-1 sm:grid-cols-[14rem_1fr] sm:items-baseline">
      <div>
        <code className="font-mono text-muted-foreground text-xs">{style}</code>
        <p className="font-mono text-muted-foreground/60 text-xs">{spec}</p>
      </div>
      <p ref={ref} className={cn("text-foreground", style)}>
        Compara precios de PC en Chile
      </p>
      {style.startsWith("text-subheading") && (
        <p className={cn("text-foreground uppercase sm:col-start-2", style)}>Tarjetas de video</p>
      )}
    </div>
  );
}

export const Tipografia: Story = {
  name: "Tipografía",
  render: () => (
    <div className="space-y-10">
      <p className="max-w-prose text-paragraph-sm text-muted-foreground">
        Escala de AlignUI: cada estilo lleva tamaño, alto de línea, interletrado y peso en una sola clase. Las escalas
        de Tailwind que coinciden (text-sm, text-base, text-lg) toman su interletrado.
      </p>
      {TYPE_GROUPS.map(([group, styles]) => (
        <section key={group} className="space-y-5">
          <h3 className="text-subheading-sm text-muted-foreground uppercase">{group}</h3>
          {styles.map((style) => (
            <TypeRow key={style} style={style} />
          ))}
        </section>
      ))}
      <section className="space-y-3">
        <h3 className="text-subheading-sm text-muted-foreground uppercase">Cifras</h3>
        <p className="font-medium text-base tabular-nums">$1.279.990 $879.990 $89.990</p>
      </section>
    </div>
  ),
};

const RADII = ["rounded-md", "rounded-lg", "rounded-xl", "rounded-2xl", "rounded-3xl", "rounded-full"] as const;

export const Radios: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      {RADII.map((r) => (
        <div key={r} className="space-y-2 text-center">
          <div className={cn("size-20 border border-border bg-card", r)} />
          <code className="font-mono text-muted-foreground text-xs">{r}</code>
        </div>
      ))}
    </div>
  ),
};

export const Superficies: Story = {
  render: () => (
    <div className="rounded-3xl bg-background p-6">
      <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <p className="font-semibold text-foreground">Tarjeta (bg-card)</p>
        <p className="text-muted-foreground text-sm">Las superficies se apilan: fondo, tarjeta y controles.</p>
        <div className="flex gap-2">
          <span className="rounded-full bg-secondary px-3 py-1.5 text-secondary-foreground text-sm">Control</span>
          <span className="rounded-full bg-primary px-3 py-1.5 text-primary-foreground text-sm">Principal</span>
        </div>
      </div>
    </div>
  ),
};
