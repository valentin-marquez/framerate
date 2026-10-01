// Tokens del tema claro de la web en hex: los clientes de correo no entienden OKLCH ni variables CSS.
export const color = {
  page: "#f8f8f8",
  card: "#ffffff",
  text: "#161616",
  muted: "#696969",
  subtle: "#eeeeee",
  border: "#ececec",
} as const;

// Satoshi sólo aparece donde el cliente ya la tenga; Gmail y Outlook caen a la fuente del sistema.
export const font = 'Satoshi, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
export const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
