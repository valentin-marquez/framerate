import {
  type CompatCheck,
  isAdditiveSlot,
  psuSizing,
  QUOTE_SLOT_LABELS,
  QUOTE_SLOTS,
  type QuoteCompatibility,
  type QuoteDetail,
  type QuoteItem as QuoteItemData,
} from "@framerate/contracts";
import { imageVariant } from "@framerate/kit";
import {
  IconAlertTriangle,
  IconBuildingStore,
  IconChevronUp,
  IconClipboard,
  IconExternalLink,
  IconFileTypeCsv,
  IconFileTypePdf,
  IconLink,
  IconMinus,
  IconPinned,
  IconPlus,
  IconShare,
  IconTag,
  IconTrash,
  IconUser,
} from "@tabler/icons-react";
import { useState } from "react";
import { Link } from "react-router";
import { QuoteAlternatives } from "~/features/quote/components/quote-alternatives";
import {
  CompatibilityIssue,
  CompatibilityList,
  issuesOf,
  STATUS_DOT,
  statusOf,
} from "~/features/quote/components/quote-compatibility";
import { QuoteLikeButton } from "~/features/quote/components/quote-like-button";
import { QuoteSlot } from "~/features/quote/components/quote-slot";
import { StoreSelector } from "~/features/quote/components/store-selector";
import { OutboundLink } from "~/shared/components/outbound-link";
import { Button } from "~/shared/components/primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/shared/components/primitives/dropdown-menu";
import { StoreLogo } from "~/shared/components/store-logo";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import type { QuoteCondensePlan } from "../fixtures";
import { Collage, componentes } from "./piezas";
import { VitrinaCondensar } from "./vitrina-condensar";

const noop = () => console.log("prototipo");

const COVER_ORDER = ["case", "cpu", "motherboard", "gpu"];

/** Las fotos del armado en el orden de la tarjeta pública: gabinete, procesador, placa madre y gráfica primero. */
const coverImages = (items: QuoteItemData[]) =>
  items
    .filter((i) => i.isSelected && i.product.imageUrl)
    .sort((a, b) => {
      const rank = (slot: string) => (COVER_ORDER.includes(slot) ? COVER_ORDER.indexOf(slot) : 9);
      return rank(a.slot) - rank(b.slot);
    })
    .map((i) => i.product.imageUrl as string);

const STATUS_RESULT: Record<QuoteCompatibility["status"], CompatCheck["result"]> = {
  valid: "ok",
  warning: "warning",
  incompatible: "incompatible",
  unknown: "unknown",
};

function compatShort({ status, checks }: QuoteCompatibility) {
  const count = (r: CompatCheck["result"]) => checks.filter((c) => c.result === r).length;
  if (status === "incompatible") {
    const n = count("incompatible");
    return `${n} ${n === 1 ? "incompatibilidad" : "incompatibilidades"}`;
  }
  if (status === "warning") {
    const n = count("warning");
    return `${n} ${n === 1 ? "advertencia" : "advertencias"}`;
  }
  return status === "valid" ? "Compatible" : "Falta revisar";
}

function Header({ quote, isOwner }: { quote: QuoteDetail; isOwner: boolean }) {
  // react-doctor-disable-next-line rendering-hydration-mismatch-time -- zona horaria fija
  const date = new Date(quote.updatedAt).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Santiago",
  });
  return (
    <header className="flex flex-col items-center gap-4 text-center md:flex-row md:items-end md:text-left">
      <Collage
        images={coverImages(quote.items)}
        small
        className="size-28 shrink-0 overflow-hidden rounded-2xl border border-border md:size-24"
      />
      <div className="min-w-0 flex-1 space-y-2">
        <h1 className="text-title-h4 text-foreground md:text-title-h3">{quote.name}</h1>
        {quote.description && <p className="max-w-2xl text-muted-foreground text-paragraph-sm">{quote.description}</p>}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-muted-foreground text-paragraph-sm md:justify-start">
          <Link to={`/u/${quote.author.username}`} className="flex items-center gap-2 hover:text-foreground">
            {quote.author.avatarUrl ? (
              <img src={quote.author.avatarUrl} alt="" className="size-6 rounded-full" />
            ) : (
              <span className="grid size-6 place-items-center rounded-full bg-secondary">
                <IconUser size={14} />
              </span>
            )}
            @{quote.author.username}
          </Link>
          <span>Actualizada el {date}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {quote.visibility === "public" && (
          <QuoteLikeButton
            liked={quote.likedByMe}
            count={quote.likeCount}
            disabled={isOwner}
            hint={isOwner ? "No puedes dar me gusta a tu propia cotización" : undefined}
            onToggle={noop}
          />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            <IconShare className="size-4" />
            Compartir
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={noop}>
              <IconLink size={16} />
              Copiar enlace
            </DropdownMenuItem>
            <DropdownMenuItem onClick={noop}>
              <IconFileTypePdf size={16} />
              Guardar como PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={noop}>
              <IconFileTypeCsv size={16} />
              Guardar como CSV o Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={noop}>
              <IconClipboard size={16} />
              Copiar al portapapeles
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

/** Misma estructura que `QuoteItem`, con la marca de "más barato" a la vista y la de tienda fijada a mano. */
function Item({
  item,
  isOwner,
  compatibility,
}: {
  item: QuoteItemData;
  isOwner: boolean;
  compatibility: QuoteCompatibility;
}) {
  const { product, offer, quantity } = item;
  const status = statusOf(compatibility, item.id);
  const pinned = item.chosenListingId !== null;
  return (
    <div className="group flex flex-col gap-4 p-4 transition-colors hover:bg-secondary/30 sm:flex-row">
      <div className="flex min-w-0 flex-1 gap-4">
        <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-[var(--product-stage)] p-1">
          {product.imageUrl && (
            <img
              src={imageVariant(product.imageUrl, 400)}
              alt={product.name}
              className={cn("size-full object-contain mix-blend-multiply", !offer && "opacity-50 grayscale")}
            />
          )}
        </div>
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            {status && <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[status])} />}
            <span className="text-muted-foreground text-subheading-2xs uppercase">{QUOTE_SLOT_LABELS[item.slot]}</span>
            {product.brand && <span className="text-muted-foreground">{product.brand}</span>}
          </div>
          <Link to={`/producto/${product.slug}`} className="block text-label-sm text-foreground hover:text-primary">
            {product.name}
          </Link>
          {item.specs.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.specs.map((spec) => (
                <span
                  key={spec}
                  className="rounded-md bg-secondary px-2 py-0.5 text-secondary-foreground text-xs tabular-nums"
                >
                  {spec}
                </span>
              ))}
            </div>
          )}
          {!offer && (
            <p className="flex items-center gap-1 font-medium text-warn text-xs">
              <IconAlertTriangle size={12} />
              No disponible en tiendas
            </p>
          )}
          {issuesOf(compatibility, item.id).map((check) => (
            <CompatibilityIssue key={check.rule} check={check} />
          ))}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-end justify-between gap-2 pl-18 sm:flex-col sm:items-end sm:pl-0 sm:text-right">
        {offer && (
          <div className="flex flex-col gap-1 sm:items-end">
            <div className="flex min-w-0 items-center gap-2">
              <StoreLogo
                store={{ name: offer.store.name, slug: offer.store.slug, icon_url: offer.store.iconUrl }}
                className="size-5 rounded-sm"
              />
              {isOwner ? (
                <StoreSelector item={item} onChoose={noop} />
              ) : (
                <OutboundLink
                  href={offer.url}
                  source="quote_item"
                  listingId={String(offer.id)}
                  productId={String(product.id)}
                  className="flex items-center gap-1 truncate text-label-sm hover:text-primary"
                >
                  {offer.store.name}
                  <IconExternalLink size={12} className="text-muted-foreground" />
                </OutboundLink>
              )}
            </div>
            <span className="text-label-lg tabular-nums">{formatCLP(offer.priceCash * quantity)}</span>
            <span className="text-muted-foreground text-xs">
              con tarjeta <span className="tabular-nums">{formatCLP(offer.priceCard * quantity)}</span>
            </span>
            {pinned ? (
              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-label-xs text-foreground">
                <IconPinned className="size-3" />
                {isOwner ? "Tienda elegida por ti" : "Tienda elegida por el autor"}
              </span>
            ) : (
              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-label-xs text-foreground">
                <IconTag className="size-3 text-success" />
                Más barato
              </span>
            )}
          </div>
        )}
        {isOwner ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={noop}
              aria-label="Eliminar producto"
            >
              <IconTrash size={14} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              aria-label="Menos unidades"
              disabled={quantity <= 1}
              onClick={noop}
            >
              <IconMinus size={14} />
            </Button>
            <span className="w-8 text-center text-sm tabular-nums">{quantity}</span>
            <Button variant="outline" size="icon" className="size-7" aria-label="Más unidades" onClick={noop}>
              <IconPlus size={14} />
            </Button>
          </div>
        ) : (
          quantity > 1 && <span className="text-muted-foreground text-xs tabular-nums">x{quantity}</span>
        )}
      </div>
    </div>
  );
}

function Components({ quote, isOwner }: { quote: QuoteDetail; isOwner: boolean }) {
  const filled = (slot: (typeof QUOTE_SLOTS)[number]) => quote.items.some((i) => i.slot === slot);
  const slots = [...QUOTE_SLOTS.filter(filled), ...QUOTE_SLOTS.filter((s) => !filled(s))];
  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-border border-b px-4 py-4 sm:px-6">
        <h2 className="text-title-h6">Componentes</h2>
        <span className="text-muted-foreground text-paragraph-sm">{componentes(quote.itemCount)}</span>
      </div>
      <div className="divide-y divide-border">
        {slots.map((slot) => {
          const items = quote.items.filter((i) => i.slot === slot);
          const shown = isAdditiveSlot(slot) ? items : items.filter((i) => i.isSelected);
          if (shown.length === 0)
            return (
              <QuoteSlot
                key={slot}
                slot={slot}
                quote={quote}
                items={[]}
                isOwner={isOwner}
                onChangeQuantity={noop}
                onRemove={noop}
                onSelect={noop}
                onChooseOffer={noop}
              />
            );
          const alternatives = items.filter((i) => !shown.includes(i));
          return (
            <div key={slot}>
              <div className="divide-y divide-border">
                {shown.map((item) => (
                  <Item key={item.id} item={item} isOwner={isOwner} compatibility={quote.compatibility} />
                ))}
              </div>
              {alternatives.length > 0 && (
                <QuoteAlternatives items={alternatives} isOwner={isOwner} onSelect={noop} onRemove={noop} />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Rows({ quote }: { quote: QuoteDetail }) {
  const { compatibility } = quote;
  const watts = compatibility.estimatedWatts;
  const psu = watts ? psuSizing(watts) : null;
  const stores = new Set(quote.items.filter((i) => i.isSelected && i.offer).map((i) => i.offer?.store.slug)).size;
  const rows: [string, React.ReactNode][] = [
    [
      "Compatibilidad",
      <span key="c" className="inline-flex items-center gap-1.5">
        <span className={cn("size-2 rounded-full", STATUS_DOT[STATUS_RESULT[compatibility.status]])} />
        {compatShort(compatibility)}
      </span>,
    ],
    ["Consumo estimado", watts ? `~${watts} W` : "Sin datos"],
    ["Fuente mínima", psu ? `${psu.minimum} W` : "Sin datos"],
    ["Fuente recomendada", psu ? `${psu.recommended} W` : "Sin datos"],
    ["Tiendas", stores],
  ];
  return (
    <dl className="space-y-2.5">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-3 text-paragraph-sm">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-right text-foreground tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Actions({ quote, plan }: { quote: QuoteDetail; plan: QuoteCondensePlan }) {
  const hasPinned = quote.items.some((i) => i.isSelected && i.chosenListingId !== null);
  return (
    <div className="grid gap-2">
      <Button variant="outline" size="lg" className="w-full" disabled={!hasPinned} onClick={noop}>
        <IconTag className="size-4" />
        Más barato en todo
      </Button>
      <VitrinaCondensar
        quote={quote}
        plan={plan}
        trigger={
          <Button size="lg" className="w-full">
            <IconBuildingStore className="size-4" />
            Condensar tiendas
          </Button>
        }
      />
    </div>
  );
}

function Totals({ quote }: { quote: QuoteDetail }) {
  const outOfStock = quote.items.some((i) => i.isSelected && !i.offer);
  return (
    <div className="space-y-1">
      <span className="text-muted-foreground text-paragraph-sm">Total en efectivo</span>
      <p className="text-title-h4 text-foreground tabular-nums">{formatCLP(quote.totals.cash)}</p>
      <p className="text-muted-foreground text-paragraph-sm">
        Con tarjeta <span className="tabular-nums">{formatCLP(quote.totals.card)}</span>
      </p>
      {outOfStock && (
        <p className="flex items-center gap-1.5 pt-1 text-label-xs text-warn">
          <IconAlertTriangle size={14} />
          Hay componentes sin stock
        </p>
      )}
    </div>
  );
}

/** En teléfono el resumen es una barra fija con total y estado; al tocarla despliega el resto. */
function MobileBar({ quote, isOwner, plan }: { quote: QuoteDetail; isOwner: boolean; plan: QuoteCondensePlan }) {
  const [open, setOpen] = useState(false);
  const { compatibility } = quote;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 rounded-t-3xl border border-border bg-card shadow-lg lg:hidden">
      {open && (
        <div className="fade-in-0 slide-in-from-bottom-2 animate-in space-y-4 border-border border-b p-4 duration-base">
          <Rows quote={quote} />
          <p className="text-muted-foreground text-paragraph-sm">
            Con tarjeta <span className="tabular-nums">{formatCLP(quote.totals.card)}</span>
          </p>
          {isOwner && <Actions quote={quote} plan={plan} />}
        </div>
      )}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <span className="block text-muted-foreground text-paragraph-xs">Total en efectivo</span>
          <span className="text-title-h6 text-foreground tabular-nums">{formatCLP(quote.totals.cash)}</span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-paragraph-sm">
          <span className={cn("size-2 rounded-full", STATUS_DOT[STATUS_RESULT[compatibility.status]])} />
          {compatShort(compatibility)}
        </span>
        <IconChevronUp className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
    </div>
  );
}

interface VitrinaCotizacionProps {
  quote: QuoteDetail;
  isOwner: boolean;
  /** Plan de "Condensar tiendas" que mostraría el servidor. */
  plan: QuoteCondensePlan;
}

export function VitrinaCotizacion({ quote, isOwner, plan }: VitrinaCotizacionProps) {
  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-8 pb-40 lg:pb-16">
      <Header quote={quote} isOwner={isOwner} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Components quote={quote} isOwner={isOwner} />
          {quote.compatibility.checks.length > 0 && <CompatibilityList compatibility={quote.compatibility} />}
        </div>
        <aside className="hidden min-w-0 space-y-5 rounded-3xl border border-border bg-card p-6 lg:sticky lg:top-4 lg:block">
          <h2 className="text-label-lg">Resumen</h2>
          <Rows quote={quote} />
          <hr className="border-border" />
          <Totals quote={quote} />
          {isOwner && <Actions quote={quote} plan={plan} />}
        </aside>
      </div>
      <MobileBar quote={quote} isOwner={isOwner} plan={plan} />
    </div>
  );
}
