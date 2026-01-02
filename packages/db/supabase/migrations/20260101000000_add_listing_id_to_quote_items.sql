-- Add listing_id to quote_items to allow selecting specific store/price
ALTER TABLE "public"."quote_items" 
ADD COLUMN "listing_id" uuid REFERENCES "public"."listings"("id");

-- Add index for performance
CREATE INDEX "quote_items_listing_id_idx" ON "public"."quote_items"("listing_id");
