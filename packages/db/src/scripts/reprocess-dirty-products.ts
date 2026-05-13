import { client } from "../client";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://qkvqtkrsmrzegckrakwb.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrdnF0a3JzbXJ6ZWdja3Jha3diIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NDQ1MjMsImV4cCI6MjA3OTUyMDUyM30.JZJdpiZ9mS_A0SSvzYVENLuGc-B6VwjK770j41A0UUs";

const supabase = client({
  url: SUPABASE_URL,
  key: SUPABASE_KEY,
});

// Keys that indicate raw dirty data
const DIRTY_KEYS = ["Alto", "Peso", "Ancho", "Largo", "Garantía", "Condición", "manufacturer"];

// Schemas are complex to validate here without importing all of them.
// We'll use a heuristic: if specs has keys that are typically raw Spanish scraper output
// OR if specs is null but we have an MPN, we should reprocess.
// Actually, if specs is null, we might want to reprocess if we never tried.

async function main() {
  console.log("Starting dirty product reprocessing scan...");

  let page = 0;
  const pageSize = 100;
  let processedCount = 0;
  let queuedCount = 0;

  while (true) {
    const { data: products, error } = await supabase
      .from("products")
      .select("id, mpn, name, specs, category_id, brand_id, search_vector") // search_vector join might be heavy? No, it's a column.
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error("Error fetching products:", error);
      break;
    }

    if (!products || products.length === 0) {
      break;
    }

    console.log(`Processing page ${page}, products: ${products.length}`);

    for (const product of products) {
      let isDirty = false;
      const specs = product.specs as Record<string, any> | null;

      if (specs) {
        // Check for specific raw keys
        const keys = Object.keys(specs);
        if (keys.some((k) => DIRTY_KEYS.includes(k) || k.includes(" "))) {
          // Raw keys often have spaces or are Spanish words
          isDirty = true;
        }

        // Check if strict schema compliance (simplified check)
        // Most valid schemas use snake_case keys like 'core_count', 'memory_gb'
        // If we see CamelCase or keys with spaces, it's likely dirty.
        if (!isDirty && keys.some((k) => /[A-Z]/.test(k) || k.includes(" "))) {
          isDirty = true;
        }
      } else {
        // If specs is null, we might want to try to extract if we have MPN
        if (product.mpn) {
          isDirty = true; // Treat as "needs processing"
        }
      }

      if (isDirty && product.mpn) {
        // Check if there is already a pending or completed job for this MPN to avoid loop?
        // For now, we'll just check pending.
        const { data: existing } = await supabase
          .from("extraction_jobs")
          .select("id")
          .eq("mpn", product.mpn)
          .in("status", ["pending", "processing"])
          .limit(1);

        if (!existing || existing.length === 0) {
          // Get category slug from ID (we need to fetch categories to map UUID to slug)
          // For efficiency, let's fetch categories once.
          // ... implementing category cache below ...

          const categorySlug = await getCategorySlug(product.category_id);
          if (categorySlug) {
            console.log(`Queueing job for dirty product: ${product.mpn} (${product.name.substring(0, 30)}...)`);

            const { error: insertError } = await supabase.from("extraction_jobs").insert({
              mpn: product.mpn,
              category: categorySlug,
              raw_text: JSON.stringify(product.specs || {}), // Pass existing specs as raw text so AI can try to use them? Or empty?
              // Better to pass Name + Specs as raw context
              normalized_title: product.name,
              context: {
                source: "reprocess_dirty",
                original_specs: product.specs,
              },
            });

            if (insertError) {
              console.error(`Failed to queue job for ${product.mpn}:`, insertError.message);
            } else {
              queuedCount++;
            }
          } else {
            console.warn(`Could not resolve category for product ${product.id}`);
          }
        }
      }
      processedCount++;
    }

    page++;
    // Safety break
    if (page > 100) break; // Max 10000 products
  }

  console.log(`Scan complete. processed: ${processedCount}, queued: ${queuedCount}`);
}

const categoryCache: Record<string, string> = {};
async function getCategorySlug(id: string): Promise<string | null> {
  if (categoryCache[id]) return categoryCache[id];

  // We assume 'categories' table exists and has 'slug'
  // Let's list table structure first? No, we can brute force query.
  // Actually, 'categories' table usually has 'slug'.
  const { data } = await supabase.from("categories").select("slug").eq("id", id).single();
  if (data?.slug) {
    categoryCache[id] = data.slug;
    return data.slug;
  }
  return null;
}

main();
