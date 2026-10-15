import { z } from "zod";
import { CATEGORIES } from "./category-list";

// Las constantes viven aparte, sin zod: la web las importa y no debe arrastrar zod al navegador.
export * from "./category-list";

export const CategorySchema = z.enum(CATEGORIES);
