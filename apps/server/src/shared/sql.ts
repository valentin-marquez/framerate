/** Escapa `%`, `_` y `\` para usar texto del usuario como patrón LIKE literal (con `ESCAPE '\\'`). */
export const likePattern = (text: string) => `%${text.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
