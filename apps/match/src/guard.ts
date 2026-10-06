import { canonicalBrand, detectBrand, normalizeMpn } from "@framerate/matching";
import type { Side } from "./judge";

export type Guard = { ok: true } | { ok: false; reason: string };

// Un LLM no sabe lo que el título no dice: si un lado trae esto y el otro no, es otro producto o no se puede saber.
const MODEL_TOKEN = /^(v\d|ii|iii|ac|ax\d?|wifi\d*e?|csm|pcie5)$/;
// Placas Intel de las series 400 a 700: la misma placa existe con DDR4 y con DDR5; en AM4, AM5 y la serie 800 la
// generación la fija el socket y omitirla no cambia el producto.
const INTEL_BOTH_DDR = /\b[hbz][4-7][1679]0/;

function modelTokens(title: string): Set<string> {
  const t = title.toLowerCase().replace(/wi[ -]fi/g, "wifi");
  const words = t.split(/[^a-z0-9]+/).filter((w) => MODEL_TOKEN.test(w));
  return new Set(words.map((w) => (/^(ac|ax|wifi)/.test(w) ? "wifi" : w)));
}

// En SSD la generación PCIe separa productos (Kingston Renegade G4 y G5); en GPU y placas se repite como ficha técnica.
function ssdPcie(title: string): string | null {
  const t = title.toLowerCase();
  return /nvme|ssd|estado s/.test(t) && !/placa|madre|m\/b/.test(t)
    ? (t.match(/(?:pcie?|gen) ?([345])(?!\d)/)?.[1] ?? null)
    : null;
}

function generation(title: string): string | null {
  const m = title.toLowerCase().match(/\b(?:ddr|d)([45])\b/);
  return m ? `ddr${m[1]}` : null;
}

// Título con texto que parece dirigido al modelo; las tiendas escriben los títulos y entran tal cual al prompt.
const INSTRUCTION =
  /\b(ignor[ae]\w*|disregard|forget|olvida\w*|system|assistant|prompt|instruc\w+|respond\w*|answer|reply|same|different|igual|distinto|diferente|responde\w*|acepta\w*|accept|reject)\b/i;
const INSTRUCTION_LEGIT = /\b(system|sistema)\s+(cooling|builder|ready|integrado)\b/i;

export function hasInstructionText(title: string): boolean {
  return INSTRUCTION.test(title.replace(INSTRUCTION_LEGIT, ""));
}

const identified = (s: Side) => !!(canonicalBrand(s.brand) ?? detectBrand(s.title) ?? normalizeMpn(s.mpn));

export function acceptGuard(listing: Side, candidate: Side): Guard {
  for (const s of [listing, candidate]) {
    if (hasInstructionText(s.title)) return { ok: false, reason: "título con texto de instrucción" };
    if (!identified(s)) return { ok: false, reason: "sin marca ni MPN" };
  }
  const mpn = normalizeMpn(listing.mpn);
  if (mpn && mpn === normalizeMpn(candidate.mpn)) return { ok: true };
  const a = modelTokens(listing.title);
  const b = modelTokens(candidate.title);
  const diff = [...a, ...b].filter((t) => a.has(t) !== b.has(t));
  const [ga, gb] = [generation(listing.title), generation(candidate.title)];
  const intel = INTEL_BOTH_DDR.test(`${listing.title} ${candidate.title}`.toLowerCase());
  const [pa, pb] = [ssdPcie(listing.title), ssdPcie(candidate.title)];
  if (pa !== pb) diff.push(`pcie${pa ?? pb}`);
  if (ga !== gb && (intel || (ga && gb))) diff.push(ga ?? gb ?? "");
  return diff.length ? { ok: false, reason: `consta en un solo lado: ${diff.join(" ")}` } : { ok: true };
}
