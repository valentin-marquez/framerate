import { createCn } from "cn/engine";
import tables from "./cn-tables";

export { TEXT_STYLES } from "./cn.config";

// Tablas compiladas en el build (plugin `cn` en vite.config.ts, desde cn.config.ts): sin ellas el navegador carga el
// compilador de `cn/config`, ~45 KB más.
export const cn = createCn(tables);
