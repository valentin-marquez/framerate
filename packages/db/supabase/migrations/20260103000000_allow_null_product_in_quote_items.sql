-- Allow product_id to be null in quote_items
ALTER TABLE "public"."quote_items" ALTER COLUMN "product_id" DROP NOT NULL;

-- Add category_id column
ALTER TABLE "public"."quote_items" ADD COLUMN "category_id" uuid REFERENCES "public"."categories"("id");

-- Add constraint to ensure either product_id or category_id is present
ALTER TABLE "public"."quote_items" ADD CONSTRAINT "quote_items_product_or_category_check" CHECK (product_id IS NOT NULL OR category_id IS NOT NULL);
