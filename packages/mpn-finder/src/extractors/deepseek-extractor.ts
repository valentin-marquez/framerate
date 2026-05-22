/**
 * @module mpn-finder/extractors/deepseek-extractor
 *
 * Extractor LLM basado en DeepSeek (API OpenAI-compatible, JSON mode).
 *
 * Dada la query original + resultados de búsqueda web, pide al modelo que
 * extraiga el/los MPN del producto. La salida del LLM se valida con Zod y
 * pasa por un *grounding check*: cualquier MPN que no aparezca textualmente
 * en los snippets se descarta como alucinación.
 */

import { Logger } from "@framerate/utils";
import OpenAI from "openai";
import { z } from "zod";
import {
  emptyMpnResult,
  type LlmExtractor,
  type MpnCandidate,
  type MpnResult,
  type MpnVariant,
  type SearchResult,
} from "../types";

const logger = new Logger("MpnFinder:DeepSeek");

/** Modelo por defecto si no se configura `AI_MODEL`. */
const DEFAULT_MODEL = "deepseek-v4-flash";

/** Variantes de empaque aceptadas por el contrato `MpnVariant`. */
const VARIANT_VALUES = ["boxed", "tray", "oem", "retail", "unknown"] as const;

/** Esquema Zod de la respuesta cruda del LLM. */
const llmResponseSchema = z.object({
  mpns: z.array(
    z.object({
      value: z.string(),
      variant: z.enum(VARIANT_VALUES).catch("unknown"),
      // El modelo a veces devuelve confianza fuera de rango; la acotamos luego.
      confidence: z.number(),
    }),
  ),
  product_canonical_name: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

/** Opciones de construcción del extractor. */
export interface DeepSeekExtractorOptions {
  /** Cliente OpenAI inyectado (para testear sin red). */
  client?: OpenAI;
  /** API key; por defecto `process.env.DEEPSEEK_API_KEY`. */
  apiKey?: string;
  /** Modelo a usar; por defecto `process.env.AI_MODEL` o `DEFAULT_MODEL`. */
  model?: string;
}

/**
 * Normaliza un código para comparación de grounding: mayúsculas, sin espacios
 * ni guiones ni otros separadores. Así `BX-8071512700K` ≈ `bx8071512700k`.
 */
function normalizeCode(value: string): string {
  return value.toUpperCase().replace(/[\s\-_/.]+/g, "");
}

/** Acota la confianza al rango [0, 1] del contrato. */
function clampConfidence(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Extractor de MPN usando DeepSeek en JSON mode. */
export class DeepSeekExtractor implements LlmExtractor {
  private readonly client: OpenAI | null;
  private readonly model: string;

  constructor(options: DeepSeekExtractorOptions = {}) {
    const apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY;
    this.model = options.model ?? process.env.AI_MODEL ?? DEFAULT_MODEL;

    if (options.client) {
      // Cliente inyectado: lo usamos tal cual (tests / configuración avanzada).
      this.client = options.client;
    } else if (apiKey) {
      this.client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
    } else {
      // Sin API key no se puede extraer; quedará deshabilitado.
      this.client = null;
    }
  }

  async extract(query: string, results: SearchResult[]): Promise<MpnResult> {
    // Sin cliente (falta API key) o sin resultados → nada que extraer.
    if (!this.client || results.length === 0) {
      return emptyMpnResult(query);
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(query, results) },
        ],
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw) {
        logger.warn("DeepSeek devolvió una respuesta vacía");
        return emptyMpnResult(query);
      }

      // 1) Parseo del JSON crudo.
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(raw);
      } catch {
        logger.warn("DeepSeek devolvió JSON no parseable");
        return emptyMpnResult(query);
      }

      // 2) Validación de forma con Zod.
      const validated = llmResponseSchema.safeParse(parsedJson);
      if (!validated.success) {
        logger.warn("La respuesta del LLM no cumple el esquema esperado");
        return emptyMpnResult(query);
      }

      // 3) Grounding: descartamos MPNs que no aparezcan en los snippets.
      const haystack = normalizeCode(results.map((r) => `${r.title} ${r.snippet}`).join(" "));

      const grounded: MpnCandidate[] = [];
      let droppedHallucinations = 0;

      for (const candidate of validated.data.mpns) {
        const value = candidate.value.trim();
        if (!value) continue;

        const normalized = normalizeCode(value);
        // Un MPN demasiado corto tras normalizar genera falsos positivos.
        if (normalized.length < 3) continue;

        if (!haystack.includes(normalized)) {
          droppedHallucinations++;
          continue;
        }

        grounded.push({
          value,
          variant: candidate.variant as MpnVariant,
          confidence: clampConfidence(candidate.confidence),
        });
      }

      // Orden por confianza descendente.
      grounded.sort((a, b) => b.confidence - a.confidence);

      // Componemos las notas: las del LLM + aviso de alucinaciones descartadas.
      const noteParts: string[] = [];
      if (validated.data.notes) noteParts.push(validated.data.notes);
      if (droppedHallucinations > 0) {
        noteParts.push(`Se descartaron ${droppedHallucinations} MPN no presentes en los resultados (grounding).`);
      }
      if (grounded.length === 0) {
        noteParts.push("Ningún MPN superó el grounding contra los resultados.");
      }

      return {
        query,
        mpns: grounded,
        canonicalName: validated.data.product_canonical_name ?? null,
        notes: noteParts.length > 0 ? noteParts.join(" ") : null,
        source: grounded.length > 0 ? "llm" : "none",
      };
    } catch (error) {
      // Cualquier error de la API → resultado vacío. Nunca lanzamos.
      logger.error("Error llamando a DeepSeek para extracción de MPN", error);
      return emptyMpnResult(query);
    }
  }
}

/** System prompt restrictivo: extracción de MPN sin alucinar. */
const SYSTEM_PROMPT = `Eres un extractor experto de Manufacturer Part Numbers (MPN) de hardware de PC.

Tu tarea: dada una consulta de producto y resultados de búsqueda web, identificar el/los MPN canónicos del fabricante.

Reglas estrictas:
- Un MPN es el código de parte oficial del fabricante (ej: "BX8071512700K", "GV-N4070GAMING OC-12GD", "100-100000910BOX"). NO es el EAN/código de barras, ni el SKU de la tienda.
- NUNCA inventes ni adivines códigos. Extrae SOLO MPNs que aparezcan literalmente en los títulos o snippets provistos.
- Si un mismo modelo tiene variantes de empaque, repórtalas por separado: "boxed"/"retail" (con cooler/caja), "tray"/"oem" (bulk sin caja), o "unknown" si no se distingue.
- Si no hay ningún MPN claro en los resultados, devuelve "mpns": [].
- La confianza es un número en [0, 1] según cuán seguro estés de que el código es el MPN correcto.

Responde EXCLUSIVAMENTE con un objeto JSON con esta forma exacta:
{
  "mpns": [{"value": string, "variant": "boxed"|"tray"|"oem"|"retail"|"unknown", "confidence": number}],
  "product_canonical_name": string|null,
  "notes": string|null
}`;

/** Construye el mensaje de usuario con la query y los resultados de búsqueda. */
function buildUserPrompt(query: string, results: SearchResult[]): string {
  const resultsBlock = results
    .map((r, i) => {
      return [`[${i + 1}]`, `Título: ${r.title}`, `Snippet: ${r.snippet}`, `URL: ${r.url}`].join("\n");
    })
    .join("\n\n");

  return `Consulta original del producto:
${query}

Resultados de búsqueda web:
${resultsBlock}

Extrae el/los MPN según las reglas. Responde solo con el JSON.`;
}
