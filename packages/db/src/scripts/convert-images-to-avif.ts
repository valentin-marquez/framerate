import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { getStoragePublicUrl, StorageBuckets } from "../storage";

const SUPABASE_URL = Bun.env.SUPABASE_URL;
const SUPABASE_KEY = Bun.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("Starting Image to AVIF conversion...");

  // Fetch all products that have an image_url
  // We will filter in JS or rely on the query to find non-avif
  // Supabase/Postgrest ilike '%.avif' negation is tricky in one go if we want "not ending in avif"
  // Easier to fetch all with image_url and filter in code, or try specific extensions.

  // Let's try to fetch all products where image_url is not null.
  // We can process in batches if there are many.

  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .not("image_url", "is", null);

  console.log(`Total products with images: ${count}`);

  const BATCH_SIZE = 100;
  let processedCount = 0;
  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0; // Already AVIF

  // Pagination loop
  let hasMore = true;
  let page = 0;

  while (hasMore) {
    const { data: products, error } = await supabase
      .from("products")
      .select("id, image_url, mpn")
      .not("image_url", "is", null)
      .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1);

    if (error) {
      console.error("Error fetching products:", error);
      break;
    }

    if (!products || products.length === 0) {
      hasMore = false;
      break;
    }

    for (const product of products) {
      const { id, image_url, mpn } = product;
      if (!image_url) continue;

      // Check if already avif
      if (image_url.toLowerCase().endsWith(".avif")) {
        // console.log(`Skipping ${id} - already AVIF`);
        skippedCount++;
        continue;
      }

      console.log(`Processing product ${id} (${mpn}): ${image_url}`);

      try {
        // 1. Extract file path from URL
        const bucketUrlPart = `/storage/v1/object/public/${StorageBuckets.PRODUCT_IMAGES}/`;
        const urlParts = image_url.split(bucketUrlPart);

        if (urlParts.length !== 2) {
          // Might be an external URL that we haven't downloaded yet, or a weird format
          // If it is external, we probably want to download it, convert it, and upload it to our bucket?
          // Existing script assumed it was in our bucket.
          // If it is simply not in our bucket format, we skip for now to be safe, or we could handle generic URLs.
          // Existing script logic:
          console.warn(`  Skipping: Could not extract file path from URL (might be external) ${image_url}`);
          failCount++;
          continue;
        }

        const originalFilePath = urlParts[1];

        // 2. Download current image
        const { data: blob, error: downloadError } = await supabase.storage
          .from(StorageBuckets.PRODUCT_IMAGES)
          .download(originalFilePath);

        if (downloadError) {
          console.error(`  Error downloading ${originalFilePath}:`, downloadError.message);
          failCount++;
          continue;
        }

        // 3. Convert to AVIF using Sharp
        const arrayBuffer = await blob.arrayBuffer();
        const avifBuffer = await sharp(new Uint8Array(arrayBuffer)).avif({ quality: 80 }).toBuffer();

        // 4. Determine new file path
        // Replace extension or append .avif
        let newFilePath = originalFilePath;
        const lastDotIndex = newFilePath.lastIndexOf(".");
        if (lastDotIndex !== -1) {
          newFilePath = newFilePath.substring(0, lastDotIndex) + ".avif";
        } else {
          newFilePath = newFilePath + ".avif";
        }

        // 5. Upload AVIF image
        const { error: uploadError } = await supabase.storage
          .from(StorageBuckets.PRODUCT_IMAGES)
          .upload(newFilePath, avifBuffer, {
            contentType: "image/avif",
            upsert: true,
          });

        if (uploadError) {
          console.error(`  Error uploading ${newFilePath}:`, uploadError.message);
          failCount++;
          continue;
        }

        // 6. Generate new public URL
        const newImageUrl = getStoragePublicUrl(SUPABASE_URL!, StorageBuckets.PRODUCT_IMAGES, newFilePath);

        // 7. Update product in DB
        const { error: updateError } = await supabase.from("products").update({ image_url: newImageUrl }).eq("id", id);

        if (updateError) {
          console.error(`  Error updating product ${id}:`, updateError.message);
          failCount++;
          continue;
        }

        // 8. Delete old image (if different name)
        if (originalFilePath !== newFilePath) {
          const { error: deleteError } = await supabase.storage
            .from(StorageBuckets.PRODUCT_IMAGES)
            .remove([originalFilePath]);

          if (deleteError) {
            console.warn(`  Warning: Could not delete old file ${originalFilePath}:`, deleteError.message);
          }
        }

        console.log(`  Success! Updated to ${newImageUrl}`);
        successCount++;
      } catch (err) {
        console.error(`  Unexpected error processing product ${id}:`, err);
        failCount++;
      }
    }

    processedCount += products.length;
    console.log(`Processed batch. Total processed: ${processedCount}/${count}`);
    page++;
  }

  console.log("--------------------------------------------------");
  console.log(`Finished.`);
  console.log(`Skipped (already AVIF): ${skippedCount}`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
}

main().catch(console.error);
