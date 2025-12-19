import { z } from "zod";
import { callLLM } from "../llm-client";
import logger0 from "../logger";

export const SYSTEM_PROMPT = `Eres un extractor de specs técnicas de hardware. Responde SOLO con JSON válido.
REGLAS:
- Usa tu conocimiento de specs reales de productos cuando el texto no lo mencione
- "Desconocido" o "Desconocida" solo si realmente no puedes inferirlo
- Arrays vacíos [] si no hay datos
- Formatos: velocidades en "X MHz/GHz", tamaños en "X GB/TB/mm", potencia en "XW"`;

export abstract class BaseExtractor<T> {
  protected logger = logger0;

  protected abstract getZodSchema(): z.ZodSchema<T>;
  protected abstract extractWithLLM(text: string, context?: any, lastError?: string): Promise<T>;

  protected async extractWithRetry(text: string, context?: any, retries = 2): Promise<T> {
    let lastError = "";

    for (let i = 0; i <= retries; i++) {
      try {
        const specs = await this.extractWithLLM(text, context, lastError);
        return this.getZodSchema().parse(specs);
      } catch (error: unknown) {
        if (error instanceof z.ZodError) {
          lastError = `Validation failed: ${error.message}`;
          this.logger.warn(`Attempt ${i + 1} failed validation. Retrying with feedback...`);
        } else {
          throw error;
        }
      }
    }

    throw new Error("Max validation retries reached");
  }

  protected async callLLM(params: any) {
    return callLLM(params);
  }
}
