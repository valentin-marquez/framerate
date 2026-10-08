import type { MatchReviewItem } from "@framerate/contracts";
import { cn } from "~/shared/lib/utils";

/** Lo que `framerate-match` guarda en `evidence` (ver apps/match). Todo opcional: una revisión vieja no lo trae. */
export interface ReviewEvidence {
  titleSimilarity?: number;
  brandMatch?: boolean;
  mpnConflict?: boolean;
  modelConflict?: boolean;
  attributeKeyMatch?: boolean;
  sameImage?: boolean;
  detector?: "attribute_key" | "model_ai";
  ai?: { pAB?: number; pBA?: number; verdict?: string; guard?: string; model?: string };
}

export type Verdict = "accept" | "reject" | "pending" | "guard" | "none";

/** El veredicto que manda en la fila: la guarda pisa al modelo, porque es la que decide si se puede aceptar. */
export function verdictOf(evidence: ReviewEvidence): Verdict {
  const ai = evidence.ai;
  if (!ai || ai.pAB === undefined || ai.pBA === undefined) return "none";
  if (ai.guard) return "guard";
  if (ai.verdict === "accept") return "accept";
  if (ai.verdict === "reject") return "reject";
  return "pending";
}

export const VERDICT_LABELS: Record<Verdict, string> = {
  accept: "El modelo acepta",
  reject: "El modelo rechaza",
  pending: "El modelo duda",
  guard: "Frenada por la guarda",
  none: "Sin veredicto",
};

const VERDICT_TONE: Record<Verdict, string> = {
  accept: "bg-success",
  reject: "bg-destructive",
  pending: "bg-warn",
  guard: "bg-warn",
  none: "bg-muted-foreground/40",
};

const SEGMENTS = 10;

/**
 * La probabilidad del modelo como la referencia del dueño: número grande, barra segmentada y etiqueta. Se muestra la
 * menor de los dos órdenes, que es la que manda para aceptar (hacen falta 0,9 en los dos).
 */
export function ProbabilityMeter({ evidence }: { evidence: ReviewEvidence }) {
  const { pAB, pBA } = evidence.ai ?? {};
  const verdict = verdictOf(evidence);
  if (pAB === undefined || pBA === undefined) {
    return <p className="text-sm text-muted-foreground">Sin veredicto del modelo</p>;
  }
  const low = Math.min(pAB, pBA);
  const filled = Math.round(low * SEGMENTS);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <span className="font-semibold text-2xl tabular-nums tracking-tight">{Math.round(low * 100)}%</span>
        <span className="text-muted-foreground text-xs">{VERDICT_LABELS[verdict]}</span>
      </div>
      <div
        className="flex h-2 items-stretch gap-px"
        role="img"
        aria-label={`Probabilidad de que sean el mismo producto: ${Math.round(low * 100)} por ciento`}
      >
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span
            // Son posiciones fijas de una barra, no datos que se reordenen.
            // biome-ignore lint/suspicious/noArrayIndexKey: ver arriba
            key={i}
            className={cn("flex-1 rounded-[2px]", i < filled ? VERDICT_TONE[verdict] : "bg-secondary")}
          />
        ))}
      </div>
      {Math.abs(pAB - pBA) > 0.2 && (
        <p className="text-muted-foreground text-xs tabular-nums">
          Cambia según el orden: {Math.round(pAB * 100)}% y {Math.round(pBA * 100)}%
        </p>
      )}
    </div>
  );
}

function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "warn" | "ok" }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs",
        tone === "neutral" && "bg-secondary text-muted-foreground",
        tone === "warn" && "bg-warn/20 text-foreground",
        tone === "ok" && "bg-success/15 text-success",
      )}
    >
      {children}
    </span>
  );
}

/** Lo que el matching vio, en chips, para no tener que leer el JSON. */
export function EvidenceChips({ evidence, score }: { evidence: ReviewEvidence; score: number }) {
  const guard = evidence.ai?.guard;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Chip>similitud {score.toFixed(2)}</Chip>
      {evidence.attributeKeyMatch && <Chip tone="ok">mismos atributos</Chip>}
      {evidence.brandMatch === false && <Chip tone="warn">marca distinta</Chip>}
      {evidence.mpnConflict && <Chip tone="warn">MPN distinto</Chip>}
      {evidence.modelConflict && <Chip tone="warn">modelo distinto</Chip>}
      {evidence.sameImage === true && <Chip>misma foto</Chip>}
      {evidence.detector === "model_ai" && <Chip>agrupado por modelo</Chip>}
      {guard && <Chip tone="warn">guarda: {guard}</Chip>}
    </div>
  );
}

/** Un lado del par: la foto chica, el título y sus datos. */
export function Side({
  title,
  subtitle,
  imageUrl,
  href,
  label,
}: {
  title: string;
  subtitle: string;
  imageUrl: string | null;
  href?: string;
  label: string;
}) {
  return (
    <div className="flex min-w-0 gap-3">
      <div className="size-12 shrink-0 overflow-hidden rounded-xl bg-secondary">
        {imageUrl && <img src={imageUrl} alt="" loading="lazy" className="size-full object-contain" />}
      </div>
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{label}</p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="line-clamp-2 font-medium text-sm hover:underline"
          >
            {title}
          </a>
        ) : (
          <p className="line-clamp-2 font-medium text-sm">{title}</p>
        )}
        <p className="truncate text-muted-foreground text-xs">{subtitle}</p>
      </div>
    </div>
  );
}

export const money = (value: number) => `$${value.toLocaleString("es-CL")}`;

export function describeListing(item: MatchReviewItem) {
  const parts = [item.listing.store.name, money(item.listing.priceCash)];
  if (item.listing.mpn) parts.push(`MPN ${item.listing.mpn}`);
  return parts.join("   ");
}
