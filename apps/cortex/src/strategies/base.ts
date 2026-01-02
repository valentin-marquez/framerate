import dedent from "dedent";
import type { ZodType } from "zod";
import { z } from "zod";

import { callLLM } from "../llm-client";
import logger0 from "../logger";

export const SYSTEM_PROMPT = `Eres un experto en hardware y componentes de PC. 
Tu trabajo es extraer especificaciones técnicas de texto sin estructura y convertirlas a un JSON estricto.

REGLAS CRÍTICAS:
- Responde SOLO con el objeto JSON válido según el esquema.
- El texto de entrada puede tener JSON malformado donde las claves y valores están invertidos o mezclados.
- Busca la información técnica real independientemente de cómo esté estructurado el JSON corrupto.
- Si ves patrones como "Memory":"Memory Size" o "Brand":"Series", la información útil puede estar en cualquiera de los dos lados.
- Extrae TODOS los datos técnicos que puedas identificar, incluso si están en lugares inesperados.
- Normaliza las unidades (ej: "16GB" -> "16 GB", "600W" -> "600W").
- IMPORTANTE: Revisa minuciosamente el "CONTEXTO ADICIONAL" (descripciones, HTML, tablas extra). A menudo la información más valiosa está ahí y no en el bloque principal.
- Si un campo no está explícito pero se puede inferir con certeza del contexto (ej: "RTX 4090" implica memoria "GDDR6X"), hazlo.
- Evita "Desconocido" o null a menos que sea absolutamente imposible encontrar o inferir el dato. Esfuérzate por completar todos los campos.`;

export abstract class BaseExtractor<T> {
  protected logger = logger0;

  protected abstract getZodSchema(): z.ZodType<T>;

  protected getJsonSchema() {
    const schema = this.getZodSchema();
    const jsonSchema = z.toJSONSchema(schema as unknown as ZodType<T>, { target: "draft-2020-12" });
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
    } catch (e) {
      // Si falla el parsing, devuelve el texto original
      return text;
    }
  }

  protected async extractWithLLM(text: string, context?: Record<string, unknown>, lastError?: string): Promise<T> {
    const schemaString = this.getJsonSchema();
    const processedText = this.preprocessText(text);

    const contextSection = context ? `\nCONTEXTO ADICIONAL:\n${JSON.stringify(context, null, 2)}` : "";
    const errorSection = lastError
      ? `\n⚠️ ERROR EN INTENTO ANTERIOR:\n${lastError}\n\nCorrige el JSON para que sea válido según el esquema.`
      : "";

    const prompt = dedent`
      TEXTO DE ENTRADA (puede contener JSON malformado):
      ${processedText}
      ${contextSection}

      TAREA:
      1. Analiza TODO el texto, incluyendo el CONTEXTO ADICIONAL, para extraer las especificaciones técnicas reales.
      2. IGNORA la estructura del JSON corrupto - busca los valores técnicos reales (ej: "2600 MHz", "192-Bit", "GDDR6").
      3. Tu respuesta debe ser JSON válido que cumpla EXACTAMENTE con este esquema:

      JSON SCHEMA:
      ${schemaString}
      ${errorSection}

      IMPORTANTE: Extrae TODA la información técnica que encuentres. Si falta en el texto principal, BÚSCALA en el contexto adicional.
    `;

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
      const obj = parsed as Record<string, unknown>;
      const maybe = obj as { SpecsSchema?: unknown; target?: unknown };
      if (maybe.SpecsSchema) parsed = maybe.SpecsSchema as unknown;
      else if (maybe.target) parsed = maybe.target as unknown;
    }

    return parsed as T;
  }

  protected async extractWithRetry(
    text: string,
    context?: Record<string, unknown> | undefined,
    retries = 2,
  ): Promise<T> {
    let lastError = "";

    for (let i = 0; i <= retries; i++) {
      try {
        const specs = await this.extractWithLLM(text, context, lastError);
        const validated = this.getZodSchema().parse(specs);

        // Log de éxito con datos extraídos
        this.logger.info(`Extraction successful on attempt ${i + 1}`, {
          extractedFields: Object.keys(validated as object).length,
        });

        return validated;
      } catch (error: unknown) {
        if (error instanceof z.ZodError) {
          const formattedError = JSON.stringify(error.format(), null, 2);
          lastError = `Validation failed: ${error.message}\nDetails: ${formattedError}`;
          this.logger.warn(`Attempt ${i + 1}/${retries + 1} failed validation. Retrying...`, {
            error: error.message,
          });
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
