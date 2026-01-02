import { Logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

const logger = new Logger("MaintenanceService");

export class MaintenanceService {
  async groupVariants() {
    logger.info("Iniciando agrupación de variantes...");

    // 1. Obtener todos los productos
    const { data: products, error } = await supabase
      .from("products")
      .select("id, name, mpn, brand_id, group_id, category_id")
      .not("mpn", "is", null);

    if (error) {
      logger.error("Error al obtener productos:", error);
      throw error;
    }

    if (!products) {
      logger.info("No se encontraron productos.");
      return { message: "No products found", count: 0 };
    }

    logger.info(`Se obtuvieron ${products.length} productos.`);

    // 2. Agrupar por Marca
    const productsByBrand: Record<string, typeof products> = {};
    for (const p of products) {
      if (!p.brand_id) continue;
      if (!productsByBrand[p.brand_id]) {
        productsByBrand[p.brand_id] = [];
      }
      productsByBrand[p.brand_id].push(p);
    }

    let linkedCount = 0;

    // 3. Encontrar variantes
    for (const brandId in productsByBrand) {
      const brandProducts = productsByBrand[brandId];
      // Ordenar por MPN para encontrar coincidencias cercanas fácilmente
      brandProducts.sort((a, b) => (a.mpn || "").localeCompare(b.mpn || ""));

      for (let i = 0; i < brandProducts.length; i++) {
        const p1 = brandProducts[i];
        if (!p1.mpn) continue;

        // Mirar hacia adelante para coincidencias
        for (let j = i + 1; j < brandProducts.length; j++) {
          const p2 = brandProducts[j];
          if (!p2.mpn) continue;

          if (this.areVariants(p1.mpn, p2.mpn)) {
            logger.info(`Variantes potenciales encontradas: ${p1.mpn} <-> ${p2.mpn}`);
            await this.linkProducts(p1, p2);
            linkedCount++;
          }
        }
      }
    }
    logger.info("Agrupación de variantes finalizada.");
    return { message: "Variants grouped successfully", count: linkedCount };
  }

  private areVariants(mpn1: string, mpn2: string): boolean {
    if (mpn1 === mpn2) return false;

    const commonPrefix = this.getCommonPrefix(mpn1, mpn2);
    const maxLen = Math.max(mpn1.length, mpn2.length);

    if (maxLen > 5 && commonPrefix.length / maxLen > 0.85) {
      const suffix1 = mpn1.slice(commonPrefix.length);
      const suffix2 = mpn2.slice(commonPrefix.length);

      if (suffix1.length <= 4 && suffix2.length <= 4) {
        return true;
      }
    }
    return false;
  }

  private getCommonPrefix(s1: string, s2: string): string {
    let i = 0;
    while (i < s1.length && i < s2.length && s1[i] === s2[i]) {
      i++;
    }
    return s1.slice(0, i);
  }

  // biome-ignore lint/suspicious/noExplicitAny: Tipos dinámicos de productos
  private async linkProducts(p1: any, p2: any) {
    let groupId = p1.group_id || p2.group_id;

    if (p1.group_id && p2.group_id && p1.group_id !== p2.group_id) {
      logger.info(`La fusión de grupos ${p1.group_id} y ${p2.group_id} no está implementada aún.`);
      return;
    }

    if (p1.category_id !== p2.category_id) {
      logger.info(
        `Omitiendo variantes con categorías diferentes: ${p1.mpn} (${p1.category_id}) <-> ${p2.mpn} (${p2.category_id})`,
      );
      return;
    }

    if (!groupId) {
      const { data: group, error } = await supabase
        .from("product_groups")
        .insert({ name: p1.name, category_id: p1.category_id })
        .select()
        .single();

      if (error) {
        logger.error("Error al crear grupo:", error);
        return;
      }
      groupId = group.id;
      logger.info(`Nuevo grupo creado ${groupId}`);
    }

    if (p1.group_id !== groupId) {
      await supabase.from("products").update({ group_id: groupId }).eq("id", p1.id);
    }
    if (p2.group_id !== groupId) {
      await supabase.from("products").update({ group_id: groupId }).eq("id", p2.id);
    }

    p1.group_id = groupId;
    p2.group_id = groupId;
  }
}
