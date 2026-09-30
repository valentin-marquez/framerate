import type { ApiError } from "@framerate/contracts";
import { createLogger } from "@framerate/kit";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";

/** Error esperado de la aplicación: se responde tal cual al cliente. */
export class AppError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

const log = createLogger({ feature: "http" });

/** Handler global: formato único de error y nunca filtra detalles internos. */
export function handleError(error: Error, c: Context) {
  if (error instanceof AppError) {
    return c.json<ApiError>({ error: { code: error.code, message: error.message } }, error.status);
  }
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    return c.json<ApiError>(
      {
        error: {
          code: "invalid_request",
          message: `${issue?.path.join(".") || "request"}: ${issue?.message ?? "inválido"}`,
        },
      },
      400,
    );
  }
  log.error("unhandled_error", { error, path: c.req.path, method: c.req.method });
  return c.json<ApiError>({ error: { code: "internal_error", message: "Error interno" } }, 500);
}

export function notFound(c: Context) {
  return c.json<ApiError>({ error: { code: "not_found", message: "Ruta no encontrada" } }, 404);
}
