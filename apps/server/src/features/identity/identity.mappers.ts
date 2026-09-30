import type { Me, PublicProfile } from "@framerate/contracts";
import { avatarUrl } from "./domain/avatar";
import type { UserRow } from "./identity.repository";
import type { ActiveBan } from "./types";

/** Fila de base → contrato de la API. Es el único lugar que decide qué datos salen a cada audiencia. */

export function toMe(user: UserRow, ban: ActiveBan | null, assetsBaseUrl?: string): Me {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.display_name,
    avatarUrl: avatarUrl(user, assetsBaseUrl),
    bio: user.bio,
    lang: user.lang,
    theme: user.theme,
    role: user.role,
    createdAt: user.created_at,
    ban,
  };
}

/** Perfil público: sin correo, rol, sanciones ni preferencias. */
export function toPublicProfile(user: UserRow, assetsBaseUrl?: string): PublicProfile {
  return {
    username: user.username,
    displayName: user.display_name,
    avatarUrl: avatarUrl(user, assetsBaseUrl),
    bio: user.bio,
    createdAt: user.created_at,
  };
}
