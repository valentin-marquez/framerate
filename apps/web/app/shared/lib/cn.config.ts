// Lo lee el plugin `cn` de vite.config.ts al compilar `cn-tables.ts`: sólo TypeScript que Node ejecute tal cual (sin alias).
/** Estilos de texto de `app.css` (`@theme`). Sin esta lista, `cn("text-title-h1 text-foreground")` descarta el título. */
export const TEXT_STYLES = [
  "title-h1",
  "title-h2",
  "title-h3",
  "title-h4",
  "title-h5",
  "title-h6",
  "label-xl",
  "paragraph-xl",
  "label-lg",
  "paragraph-lg",
  "label-md",
  "paragraph-md",
  "label-sm",
  "paragraph-sm",
  "label-xs",
  "paragraph-xs",
  "subheading-md",
  "subheading-sm",
  "subheading-xs",
  "subheading-2xs",
  "doc-label",
  "doc-paragraph",
] as const;

export default { extend: { classGroups: { "font-size": [{ text: [...TEXT_STYLES] }] } } };
