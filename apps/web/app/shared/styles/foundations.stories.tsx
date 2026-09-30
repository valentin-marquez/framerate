import type { Meta, StoryObj } from "@storybook/react-vite";

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
    <div className={`h-16 rounded-2xl border border-border ${className}`} />
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

const TYPE_SCALE = [
  ["text-5xl font-semibold tracking-tight", "Título de cabecera"],
  ["text-3xl font-semibold tracking-tight", "Título de página"],
  ["text-xl font-semibold", "Título de sección"],
  ["text-base font-medium", "Etiqueta destacada"],
  ["text-base", "Texto de cuerpo: compara precios de las tiendas de Chile."],
  ["text-sm text-muted-foreground", "Texto secundario y descripciones"],
  ["text-xs text-muted-foreground", "Metadatos · 8 productos · $279.990"],
] as const;

export const Tipografia: Story = {
  name: "Tipografía",
  render: () => (
    <div className="space-y-5">
      {TYPE_SCALE.map(([className, text]) => (
        <div key={className} className="grid gap-1 sm:grid-cols-[16rem_1fr] sm:items-baseline">
          <code className="font-mono text-muted-foreground text-xs">{className}</code>
          <p className={`text-foreground ${className}`}>{text}</p>
        </div>
      ))}
    </div>
  ),
};

const RADII = ["rounded-md", "rounded-lg", "rounded-xl", "rounded-2xl", "rounded-3xl", "rounded-full"] as const;

export const Radios: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      {RADII.map((r) => (
        <div key={r} className="space-y-2 text-center">
          <div className={`size-20 border border-border bg-card ${r}`} />
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
