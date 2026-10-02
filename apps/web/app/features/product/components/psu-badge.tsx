import { IconBoltFilled, IconVolume } from "@tabler/icons-react";
import { cn } from "~/shared/lib/utils";

// Colores de cada nivel: son la identidad del sello, no del tema, y por eso no cambian en oscuro (el sello se lee como
// una etiqueta pegada sobre la foto). La tinta es la del texto del sistema en claro.
const INK = "oklch(0.2 0 0)";

const PLUS_TIERS = {
  white: { label: "White", color: "oklch(0.995 0 0)" },
  bronze: { label: "Bronze", color: "oklch(0.66 0.1 58)" },
  silver: { label: "Silver", color: "oklch(0.8 0.006 250)" },
  gold: { label: "Gold", color: "oklch(0.83 0.13 86)" },
  platinum: { label: "Platinum", color: "oklch(0.91 0.01 250)" },
  titanium: { label: "Titanium", color: "oklch(0.64 0.025 165)" },
};

const ETA_TIERS = {
  diamond: { label: "Diamond", color: "oklch(0.6 0.12 232)" },
  titanium: { label: "Titanium", color: "oklch(0.36 0.01 250)" },
  platinum: { label: "Platinum", color: "oklch(0.5 0.01 250)" },
  gold: { label: "Gold", color: "oklch(0.66 0.13 78)" },
  silver: { label: "Silver", color: "oklch(0.64 0.005 250)" },
  bronze: { label: "Bronze", color: "oklch(0.56 0.1 50)" },
  standard: { label: "Standard", color: "oklch(0.52 0.17 25)" },
};

const LAMBDA_TIERS = {
  "a++": { label: "A++", color: "oklch(0.5 0.17 300)" },
  "a+": { label: "A+", color: "oklch(0.52 0.15 255)" },
  a: { label: "A", color: "oklch(0.58 0.1 205)" },
  "a-": { label: "A−", color: "oklch(0.6 0.14 150)" },
  "standard++": { label: "Standard++", color: "oklch(0.66 0.14 100)" },
  "standard+": { label: "Standard+", color: "oklch(0.66 0.15 58)" },
  standard: { label: "Standard", color: "oklch(0.54 0.18 28)" },
};

type Tier = { label: string; color: string };
type Seal = { scheme: "80plus" | "eta" | "lambda"; tier: Tier };

/**
 * Acepta el nivel tal como lo entrega la API (`gold`, `white`) o el texto de la tienda ("80 Plus Gold"). Cybenetics
 * llega como `eta-platinum` o `lambda-a+`. Lo que no reconoce no dibuja nada.
 */
export function readCertification(value: string): Seal | null {
  const v = value.toLowerCase().trim();
  const cyb = v.match(/\b(eta|lambda)[\s_-]*([a-z+-]+)/);
  if (cyb) {
    const tiers: Record<string, Tier | undefined> = cyb[1] === "eta" ? ETA_TIERS : LAMBDA_TIERS;
    const tier = tiers[cyb[2] ?? ""];
    if (tier) return { scheme: cyb[1] as "eta" | "lambda", tier };
  }
  const word = v.replace("bronce", "bronze").match(/white|bronze|silver|gold|platinum|titanium/)?.[0];
  if (word) return { scheme: "80plus", tier: PLUS_TIERS[word as keyof typeof PLUS_TIERS] };
  return /80 ?plus|80\+/.test(v) ? { scheme: "80plus", tier: PLUS_TIERS.white } : null;
}

const NAMES = { "80plus": "80 Plus", eta: "Cybenetics ETA", lambda: "Cybenetics LAMBDA" };

/** Sello de eficiencia (80 Plus) o de Cybenetics (ETA eficiencia, LAMBDA ruido). Dibujo propio, no el arte oficial. */
function PsuBadge({ certification, className }: { certification: string; className?: string }) {
  const seal = readCertification(certification);
  if (!seal) return null;
  const { tier } = seal;
  const name = `${NAMES[seal.scheme]} ${tier.label}`;
  // Las palabras largas se comprimen al ancho del sello en vez de bajar el cuerpo de letra.
  const fit = (max: number, chars: number) => (tier.label.length > chars ? max : undefined);

  if (seal.scheme === "80plus") {
    return (
      <svg
        role="img"
        aria-label={name}
        viewBox="0 0 44 60"
        width={44}
        height={60}
        className={cn("shrink-0 select-none font-sans drop-shadow-sm", className)}
      >
        <title>{name}</title>
        <rect x={0.5} y={0.5} width={43} height={59} rx={10} fill={tier.color} stroke={INK} strokeOpacity={0.18} />
        <text x={22} y={30} textAnchor="middle" fontSize={28} fontWeight={850} letterSpacing={-1.5} fill={INK}>
          80
        </text>
        <text x={22} y={39.5} textAnchor="middle" fontSize={9} fontWeight={800} letterSpacing={0.8} fill={INK}>
          PLUS
        </text>
        <rect x={4} y={43} width={36} height={12} rx={3.5} fill={INK} />
        <text
          x={22}
          y={52.2}
          textAnchor="middle"
          fontSize={8.5}
          fontWeight={700}
          letterSpacing={0.4}
          fill="oklch(1 0 0)"
          textLength={fit(32, 5)}
          lengthAdjust="spacingAndGlyphs"
        >
          {tier.label.toUpperCase()}
        </text>
      </svg>
    );
  }

  const Icon = seal.scheme === "eta" ? IconBoltFilled : IconVolume;
  const short = tier.label.length <= 3;
  return (
    <svg
      role="img"
      aria-label={name}
      viewBox="0 0 52 60"
      width={52}
      height={60}
      className={cn("shrink-0 select-none font-sans drop-shadow-sm", className)}
    >
      <title>{name}</title>
      <polygon
        points="26,2.5 49.5,16 49.5,44 26,57.5 2.5,44 2.5,16"
        fill="oklch(1 0 0)"
        stroke={tier.color}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <Icon x={20.5} y={7} size={11} stroke={2.25} color={tier.color} aria-hidden />
      <rect x={3} y={20} width={46} height={11} fill={tier.color} />
      <text x={26} y={28.4} textAnchor="middle" fontSize={7.5} fontWeight={800} letterSpacing={1} fill="oklch(1 0 0)">
        {seal.scheme === "eta" ? "ETA" : "LAMBDA"}
      </text>
      <text
        x={26}
        y={short ? 45.5 : 42.5}
        textAnchor="middle"
        fontSize={short ? 13 : 8.5}
        fontWeight={800}
        letterSpacing={short ? 0 : 0.3}
        fill={tier.color}
        textLength={fit(38, 7)}
        lengthAdjust="spacingAndGlyphs"
      >
        {short ? tier.label : tier.label.toUpperCase()}
      </text>
    </svg>
  );
}

export { PsuBadge };
