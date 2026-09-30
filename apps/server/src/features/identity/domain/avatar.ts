/**
 * URL pública del avatar. Se sirve la copia propia (R2) si existe; mientras no se
 * haya copiado, la URL https que entregó el proveedor. Una URL que no sea https
 * nunca se expone.
 */
export function avatarUrl(
  user: { avatar_key: string | null; avatar_source_url: string | null },
  assetsBaseUrl?: string,
): string | null {
  if (user.avatar_key && assetsBaseUrl) return `${assetsBaseUrl.replace(/\/+$/, "")}/${user.avatar_key}`;
  return user.avatar_source_url?.startsWith("https://") ? user.avatar_source_url : null;
}
