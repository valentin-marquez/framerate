import { AppError } from "@/shared/http/errors";
import type { SessionUser } from "./types";

/**
 * Una sanción vigente impide PUBLICAR (comentarios, reseñas, votos, reportes),
 * no iniciar sesión ni editar el perfil. Las rutas que crean contenido llaman a
 * esto: antes la restricción vivía sólo en algunas políticas RLS y la API no la aplicaba.
 */
export function assertNotBanned(user: SessionUser) {
  if (!user.ban) return;
  const until = user.ban.expiresAt ? ` hasta el ${user.ban.expiresAt.slice(0, 10)}` : " de forma permanente";
  throw new AppError(403, "banned", `Tu cuenta está suspendida${until}`);
}
