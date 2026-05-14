import dedent from "dedent";
import * as z from "zod";
import { type OpenDBItem, openDB } from "../lib/opendb";
import { mapOpenDBToSpecs } from "../lib/opendb-mappers";
import { searchWeb } from "../lib/search";
import { callLLM } from "../llm-client";
import logger0 from "../logger";

const MAX_PROMPT_CHARS = 400_000;

export type FieldMapping = {
  sources: readonly string[];
  note?: string;
};

/** Convierte un record de field mappings a un string de hints para el LLM. */
export function fieldMappingsToHints(mappings: Record<string, FieldMapping>): string {
  return Object.entries(mappings)
    .map(([target, { sources, note }]) => {
      const quoted = sources.map((s) => `"${s}"`).join(", ");
      return `${quoted} → ${target}${note ? ` (${note})` : ""}`;
    })
    .join("\n");
}
export const SYSTEM_PROMPT = `Eres un experto en hardware y componentes de PC.
Tu trabajo es extraer especificaciones técnicas de texto y convertirlas a un JSON estricto.

REGLAS:
- Responde SOLO con el objeto JSON válido según el esquema.
- Si hay una sección "OpenDB Data", úsala como FUENTE PRINCIPAL (es data curada y confiable). Complementa con el resto del texto solo si OpenDB no cubre algún campo.
- Extrae TODOS los datos técnicos que puedas identificar de cualquier fuente en el texto.
- Si el texto contiene JSON malformado (claves/valores invertidos), busca los valores técnicos reales ignorando la estructura rota.
- Normaliza unidades (ej: "16GB" → "16 GB", "600W" → "600W").
- Revisa el "CONTEXTO ADICIONAL" — a menudo contiene información valiosa no presente en el bloque principal.
- Si un campo se puede inferir con certeza (ej: "RTX 4090" → "GDDR6X"), hazlo.
- Usa null solo cuando sea imposible encontrar o inferir el dato.`;

export abstract class BaseExtractor<T> {
  protected logger = logger0;

  protected abstract getZodSchema(): z.ZodTypeAny;

  /**
   * Override en strategies para proveer hints de mapeo de campos.
   * Ayuda al LLM a conectar nombres de Icecat/retail con los campos del schema.
   */
  protected getFieldMappingHints(): string {
    return "";
  }

  /**
   * Override en strategies para enriquecer specs con campos que el LLM suele ignorar.
   * Se ejecuta después del LLM y antes de la validación Zod — es determinístico.
   */
  protected enrichSpecs(specs: Record<string, unknown>, _rawText: string): Record<string, unknown> {
    return specs;
  }

  protected getJsonSchema() {
    const schema = this.getZodSchema();
    const jsonSchema = z.toJSONSchema(schema, { target: "draft-2020-12" });
    return JSON.stringify(jsonSchema, null, 2);
  }

  /**
   * Preprocesa el raw_text para mejorar la calidad de extracción
   */
  protected preprocessText(text: string): string {
    // Intenta parsear el JSON en "Specs:" y aplanar la información
    const specsMatch = text.match(/Specs:\s*(\{.*\})/s);
    if (!specsMatch) return text;

    try {
      const specsJson = JSON.parse(specsMatch[1]);

      // Extrae todos los pares clave-valor del JSON corrupto
      const flatInfo: string[] = [];
      for (const [key, value] of Object.entries(specsJson)) {
        if (typeof value === "string" && value.trim()) {
          flatInfo.push(`${key}: ${value}`);
        }
      }

      // Reconstruye el texto con la información aplanada
      return text.replace(/Specs:.*$/s, `\n\nExtracted Information:\n${flatInfo.join("\n")}`);
    } catch (_e) {
      // Si falla el parsing, devuelve el texto original
      return text;
    }
  }

  protected async extractWithLLM(text: string, context?: Record<string, unknown>, lastError?: string): Promise<T> {
    const schemaString = this.getJsonSchema();
    let processedText = this.preprocessText(text);

    // Prepare context and error sections
    let contextStr = context ? JSON.stringify(context, null, 2) : "";
    let contextSection = context ? `\nCONTEXTO ADICIONAL:\n${contextStr}` : "";
    const errorSection = lastError
      ? `\n⚠️ ERROR EN INTENTO ANTERIOR:\n${lastError}\n\nCorrige el JSON para que sea válido según el esquema.`
      : "";

    const fieldHints = this.getFieldMappingHints();
    const hintsSection = fieldHints
      ? `\nMAPEO DE CAMPOS (usa estos nombres del texto → campo del schema):\n${fieldHints}`
      : "";

    const buildPrompt = (procText: string, ctxSection: string) => dedent`
      TEXTO DE ENTRADA (puede contener JSON malformado):
      ${procText}
      ${ctxSection}
      ${hintsSection}

      TAREA:
      1. Analiza TODO el texto, incluyendo el CONTEXTO ADICIONAL, para extraer las especificaciones técnicas reales.
      2. IGNORA la estructura del JSON corrupto - busca los valores técnicos reales (ej: "2600 MHz", "192-Bit", "GDDR6").
      3. Tu respuesta debe ser JSON válido que cumpla EXACTAMENTE con este esquema:

      JSON SCHEMA:
      ${schemaString}
      ${errorSection}

      IMPORTANTE: Extrae TODA la información técnica que encuentres. Si falta en el texto principal, BÚSCALA en el contexto adicional.
    `;

    let prompt = buildPrompt(processedText, contextSection);

    // Truncate prompt if it exceeds MAX_PROMPT_CHARS. Prefer truncating context first, then processedText.
    if (prompt.length > MAX_PROMPT_CHARS) {
      this.logger.warn("Prompt exceeds MAX_PROMPT_CHARS, truncating context/processedText", {
        promptLength: prompt.length,
        max: MAX_PROMPT_CHARS,
      });

      // 1) Try truncating context
      if (contextStr) {
        const overflow = prompt.length - MAX_PROMPT_CHARS;
        const allowedContextLen = Math.max(0, contextStr.length - overflow - 100); // leave some buffer
        if (allowedContextLen < contextStr.length) {
          contextStr = `${contextStr.slice(0, allowedContextLen)}\n... (truncated)`;
          contextSection = `\nCONTEXTO ADICIONAL:\n${contextStr}`;
          prompt = buildPrompt(processedText, contextSection);
        }
      }

      // 2) If still too big, truncate processedText (keep head and tail)
      if (prompt.length > MAX_PROMPT_CHARS) {
        const overflow = prompt.length - MAX_PROMPT_CHARS;
        // we try to keep as much as possible: keep head and tail
        const keep = Math.max(0, processedText.length - overflow - 200);
        if (keep <= 0) {
          // fallback: keep the last chunk
          processedText = processedText.slice(-Math.max(0, MAX_PROMPT_CHARS - 200));
        } else {
          const half = Math.floor(keep / 2);
          processedText = `${processedText.slice(0, half)}\n... (truncated) ...\n${processedText.slice(processedText.length - half)}`;
        }
        prompt = buildPrompt(processedText, contextSection);
      }

      // Final check
      if (prompt.length > MAX_PROMPT_CHARS) {
        throw new Error(`Prompt exceeds MAX_PROMPT_CHARS (${MAX_PROMPT_CHARS}) even after truncation`);
      }

      this.logger.info("Prompt truncated", { finalLength: prompt.length });
    }

    const completion = await this.callLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty LLM response");

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (_e) {
      throw new Error("LLM returned invalid JSON");
    }

    // Manejo de envoltorios que algunos modelos añaden
    if (parsed && typeof parsed === "object") {
      const maybe = parsed as { SpecsSchema?: unknown; target?: unknown };
      if (maybe.SpecsSchema) parsed = maybe.SpecsSchema;
      else if (maybe.target) parsed = maybe.target;
    }

    return parsed as T;
  }

  protected async extractWithRetry(
    text: string,
    context?: Record<string, unknown> | undefined,
    retries = 2,
    searchQuery?: string,
    category?: string,
    mpn?: string,
  ): Promise<{ specs: T; foundMpn?: string }> {
    let lastError = "";
    let currentText = text;
    let foundMpn: string | undefined;
    let openDBResult: OpenDBItem | null = null;
    let matchedByMpn = false;

    // 1. Try OpenDB first if we have category and a valid identifier
    if (category) {
      const normalizedTitle = context?.normalized_title as string | undefined;

      // A. Try searching by explicitly provided MPN
      if (mpn) {
        openDBResult = openDB.findProduct(category, mpn);
        if (openDBResult) {
          matchedByMpn = true;
          this.logger.info(`Found product in OpenDB by MPN: ${mpn}`);
        }
      }

      // B. If MPN search failed, try searching by Title
      if (!openDBResult) {
        const titleQuery = normalizedTitle || searchQuery?.replace(" specs", "");

        if (titleQuery) {
          openDBResult = openDB.findProduct(category, titleQuery);
          if (openDBResult) {
            this.logger.info(`Found product in OpenDB by Title: ${titleQuery}`);
            const pns = openDBResult.metadata?.part_numbers;
            if (Array.isArray(pns) && pns.length > 0) {
              foundMpn = pns[0];
            }
          }
        }
      }

      // 1.5. If OpenDB matched by MPN, try direct mapping (skip LLM entirely)
      if (openDBResult && matchedByMpn && category) {
        const mapped = mapOpenDBToSpecs(category, openDBResult);
        if (mapped) {
          try {
            const validated = this.getZodSchema().parse(mapped) as T;
            this.logger.info("OpenDB direct mapping successful — LLM skipped", {
              mpn,
              extractedFields: Object.keys(validated as object).length,
            });
            return { specs: validated, foundMpn };
          } catch (error: unknown) {
            // Mapping didn't pass Zod validation, fall through to LLM
            this.logger.info("OpenDB direct mapping failed validation, falling back to LLM", {
              mpn,
              error: error instanceof z.ZodError ? error.message : String(error),
            });
          }
        }
      }

      if (openDBResult) {
        currentText = `OpenDB Data:\n${JSON.stringify(openDBResult, null, 2)}\n\n${currentText}`;
      }
    }

    // 2. If text is empty and we have a search query, search immediately (fallback to web)
    if (!currentText.trim() && searchQuery) {
      const searchResults = await searchWeb(searchQuery);
      if (searchResults) {
        currentText = `Search Results for "${searchQuery}":\n\n${searchResults}`;
      }
    }

    for (let i = 0; i <= retries; i++) {
      try {
        const specs = await this.extractWithLLM(currentText, context, lastError);
        const enriched = this.enrichSpecs(specs as Record<string, unknown>, text);
        const validated = this.getZodSchema().parse(enriched) as T;

        this.logger.info(`Extraction successful on attempt ${i + 1}`, {
          extractedFields: Object.keys(validated as object).length,
        });

        return { specs: validated, foundMpn };
      } catch (error: unknown) {
        if (error instanceof z.ZodError) {
          const formattedError = JSON.stringify(error.format(), null, 2);
          lastError = `Validation failed: ${error.message}\nDetails: ${formattedError}`;
          this.logger.warn(`Attempt ${i + 1}/${retries + 1} failed validation. Retrying...`, {
            error: error.message,
          });

          // If validation failed and we haven't searched yet, try searching now
          if (i === 0 && searchQuery && !currentText.includes("Search Results")) {
            this.logger.info(`First attempt failed, trying search for: ${searchQuery}`);
            const searchResults = await searchWeb(searchQuery);
            if (searchResults) {
              currentText = `Search Results for "${searchQuery}":\n\n${searchResults}\n\n${currentText}`;
            }
          }
        } else {
          this.logger.error(`Non-validation error on attempt ${i + 1}`, { error });
          throw error;
        }
      }
    }

    throw new Error(`Max validation retries (${retries}) reached`);
  }

  protected async callLLM(params: Parameters<typeof callLLM>[0]) {
    return callLLM(params);
  }
}
