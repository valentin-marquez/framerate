/**
 * Audit script: replay one raw_feed entry through the pipeline directly,
 * bypass workers so we can see the actual error.
 *
 * Run: bun run apps/collector/src/scripts/audit-replay.ts
 */

import { ProductPipeline } from "@/collector/pipelines/product.pipeline";
import { BrandService } from "@/collector/services/brand.service";
import { CatalogService } from "@/collector/services/catalog.service";
import { supabase } from "@/lib/supabase";

async function main() {
  console.log("[audit] starting replay");

  // Pull a recent raw_feed entry
  const { data, error } = await supabase
    .from("raw_feed")
    .select("source, payload")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    console.error("[audit] no raw_feed entry:", error);
    return;
  }

  console.log("[audit] sample source:", data.source);
  console.log("[audit] sample payload:", JSON.stringify(data.payload).slice(0, 400));

  const catalogService = new CatalogService();
  const brandService = new BrandService();
  const pipeline = new ProductPipeline(catalogService, brandService);

  // Resolve storeId from source slug
  const storeId = await catalogService.getStoreId(data.source);
  console.log("[audit] storeId:", storeId);

  if (!storeId) {
    console.error("[audit] STORE NOT FOUND — pipeline will skip");
    return;
  }

  // Read category from payload (collectors put it there)
  const payload = data.payload as Record<string, unknown>;
  const category = (payload.category as string) ?? "ram";
  console.log("[audit] using category:", category);

  const result = await pipeline.process(payload, {
    category: category as never,
    storeId,
    crawlerType: data.source as never,
  });

  console.log("[audit] result:", result);
  process.exit(0);
}

main().catch((err) => {
  console.error("[audit] CRASHED:", err);
  process.exit(1);
});
