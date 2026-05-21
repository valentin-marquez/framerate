import { IconAlertTriangle, IconLoader2 } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import type { AutoVerifyStatus } from "../hooks/use-auto-verify";

interface VerifyStatusProps {
  status: AutoVerifyStatus;
  found: string[];
  expected: string;
  lastCheckedAt: number | null;
  checking: boolean;
  domain: string;
}

/**
 * Estado en vivo de la verificación pasiva. 🟡 mientras esperamos el TXT,
 * 🔴 cuando hay un TXT pero el valor no coincide (con el diff exacto, que es
 * lo que evita el 70% de los "no me funciona" por typo).
 */
export function VerifyStatus({ status, found, expected, lastCheckedAt, checking, domain }: VerifyStatusProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (status === "idle" || status === "verified") return null;

  const lastText = lastCheckedAt ? relativeTime(now - lastCheckedAt) : null;

  if (status === "mismatch") {
    const closest = closestFound(expected, found);
    const { prefix, diff, suffix } = splitDiff(expected, closest);
    const hint = diffHint(expected, closest);
    return (
      <div className="rounded-xl border border-warn/30 bg-warn/5 p-4">
        <div className="flex items-center gap-2 font-medium text-sm text-warn">
          <IconAlertTriangle className="size-4" />
          Encontramos un TXT, pero el valor no coincide
        </div>
        <div className="mt-3 space-y-2">
          <div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Esperado</div>
            <div className="mt-0.5 break-all rounded-md border border-border bg-background px-2 py-1 font-mono text-primary text-xs">
              {expected}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Encontrado</div>
            <div className="mt-0.5 break-all rounded-md border border-border bg-background px-2 py-1 font-mono text-muted-foreground text-xs">
              {prefix}
              {diff && <span className="rounded-sm bg-warn/30 text-warn">{diff}</span>}
              {suffix}
            </div>
          </div>
        </div>
        {hint && <p className="mt-2 text-muted-foreground text-xs">{hint}</p>}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Seguimos chequeando solos{lastText ? ` · último intento ${lastText}` : ""}.
        </p>
      </div>
    );
  }

  // waiting / error — mismo bloque, distinto texto.
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-secondary/30 px-4 py-3">
      <span className="relative flex size-2.5 shrink-0" aria-hidden>
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-warn/60" />
        <span className="relative inline-flex size-2.5 rounded-full bg-warn" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm">
          {status === "error"
            ? "No pudimos chequear el DNS — reintentando…"
            : `Esperando que aparezca el TXT en ${domain}…`}
        </div>
        <div className="text-[11px] text-muted-foreground">
          Verificamos solos cada unos segundos{lastText ? ` · último intento ${lastText}` : ""}.
        </div>
      </div>
      {checking && <IconLoader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
    </div>
  );
}

function relativeTime(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 5) return "recién";
  if (s < 60) return `hace ${s}s`;
  return `hace ${Math.round(s / 60)} min`;
}

/** El registro encontrado más parecido al esperado (mayor prefijo+sufijo común). */
function closestFound(expected: string, found: string[]): string {
  if (found.length === 0) return "";
  let best = found[0] ?? "";
  let bestScore = -1;
  for (const f of found) {
    const { prefix, suffix } = splitDiff(expected, f);
    const score = prefix.length + suffix.length;
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return best;
}

/** Parte `found` en prefijo común con `expected`, el tramo distinto y sufijo común. */
function splitDiff(expected: string, found: string): { prefix: string; diff: string; suffix: string } {
  const max = Math.min(expected.length, found.length);
  let p = 0;
  while (p < max && expected[p] === found[p]) p++;
  let s = 0;
  while (s < max - p && expected[expected.length - 1 - s] === found[found.length - 1 - s]) s++;
  return {
    prefix: found.slice(0, p),
    diff: found.slice(p, found.length - s),
    suffix: found.slice(found.length - s),
  };
}

/** Pista accionable según en qué se diferencian los valores. */
function diffHint(expected: string, found: string): string {
  if (found === expected) return "";
  if (found.trimEnd() === expected) {
    return "Parece que quedó un espacio (u otro carácter invisible) de más al final. Borralo.";
  }
  if (found.trimStart() === expected) return "Parece que quedó un espacio al principio del valor.";
  if (found.replace(/\s+/g, "") === expected.replace(/\s+/g, "")) {
    return "Hay espacios de más dentro del valor.";
  }
  if (found.toLowerCase() === expected.toLowerCase()) {
    return "Hay una diferencia de mayúsculas/minúsculas.";
  }
  if (expected.startsWith(found)) return "El valor quedó cortado — copialo completo de nuevo.";
  if (found.startsWith(expected)) return "El valor tiene texto de más al final.";
  return "Revisá que coincida carácter por carácter — lo más simple es copiarlo de nuevo con el botón.";
}
