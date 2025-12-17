-- Add stock_quantity column to listings table
-- This allows tracking product availability and stock levels per store listing

-- Add the stock_quantity column
-- NULL means stock is unknown (not scraped yet)
-- 0 means out of stock
-- Positive integers represent actual stock quantity
ALTER TABLE public.listings
ADD COLUMN stock_quantity INTEGER DEFAULT NULL;
-- Add a comment to document the column
COMMENT ON COLUMN public.listings.stock_quantity IS 
    'Stock quantity at the store. NULL = unknown, 0 = out of stock, >0 = available quantity';
-- Create an index for efficient filtering by stock status
-- This helps with queries like "show only in-stock products"
CREATE INDEX idx_listings_stock_quantity ON public.listings (stock_quantity)
WHERE stock_quantity IS NOT NULL;
-- Create a partial index for finding out-of-stock items
CREATE INDEX idx_listings_out_of_stock ON public.listings (product_id, store_id)
WHERE stock_quantity = 0 OR is_active = FALSE;
-- Create a partial index for finding in-stock items (most common query)
CREATE INDEX idx_listings_in_stock ON public.listings (product_id, store_id)
WHERE stock_quantity > 0 AND is_active = TRUE;
