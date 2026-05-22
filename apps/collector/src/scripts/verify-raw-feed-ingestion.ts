import { createMpnFinder } from "@framerate/mpn-finder";
import { type PipelineContext, ProductPipeline } from "@/collector/pipelines/product.pipeline";
import { BrandService } from "@/collector/services/brand.service";
import { CatalogService } from "@/collector/services/catalog.service";
import { Logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

async function main() {
  const logger = new Logger("VerifyCollector");
  logger.info("Starting verification of Collector -> Raw Feed ingestion...");

  const catalogService = new CatalogService();
  // BrandService might depend on DB
  const brandService = new BrandService();
  const pipeline = new ProductPipeline(catalogService, brandService, createMpnFinder(supabase));

  const mockProduct = {
    url: "https://example.com/products/test-gpu-123",
    title: "Test GPU RTX 4090 24GB [TEST-GPU-123]",
    price: 1999990,
    stock: true,
    mpn: "TEST-GPU-123",
    specs: {
      manufacturer: "TestBrand",
      model: "RTX 4090",
      vram: "24GB",
    },
  };

  const ctx: PipelineContext = {
    category: "gpu",
    storeId: "00000000-0000-0000-0000-000000000000", // Needs a valid store ID or mocked?
    crawlerType: "pc-express",
  };

  // We need a valid store ID. Let's fetch one from DB.
  const { data: store } = await supabase.from("stores").select("id").limit(1).single();
  if (store) {
    ctx.storeId = store.id;
  } else {
    logger.warn("No store found in DB, using mock ID (might fail pipeline validation if it checks)");
  }

  logger.info("Processing mock product...");
  await pipeline.process(mockProduct, ctx);

  // Check if it exists in raw_feed
  // We query by external_id (url)
  const { data: feedItem, error } = await supabase
    .from("raw_feed")
    .select("*")
    .eq("external_id", mockProduct.url)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    logger.error("Error querying raw_feed:", error.message);
    process.exit(1);
  }

  if (feedItem) {
    logger.info("✅ Verification Successful: Item found in raw_feed!");
    logger.info(`   ID: ${feedItem.id}`);
    logger.info(`   Source: ${feedItem.source}`);
    logger.info(`   Status: ${feedItem.processing_status}`);
  } else {
    logger.error("❌ Verification Failed: Item NOT found in raw_feed.");
    process.exit(1);
  }
}

main();
