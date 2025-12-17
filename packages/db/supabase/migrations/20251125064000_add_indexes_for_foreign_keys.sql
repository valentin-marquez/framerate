-- Add indexes for foreign keys to improve performance
-- Based on Supabase Advisor recommendations

-- listings
CREATE INDEX IF NOT EXISTS idx_listings_product_id ON public.listings(product_id);
-- price_alerts
CREATE INDEX IF NOT EXISTS idx_price_alerts_product_id ON public.price_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_user_id ON public.price_alerts(user_id);
-- price_history
CREATE INDEX IF NOT EXISTS idx_price_history_listing_id ON public.price_history(listing_id);
-- product_reviews
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON public.product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_user_id ON public.product_reviews(user_id);
-- products
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON public.products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
-- quote_items
CREATE INDEX IF NOT EXISTS idx_quote_items_product_id ON public.quote_items(product_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON public.quote_items(quote_id);
-- quotes
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON public.quotes(user_id);
-- store_reviews
CREATE INDEX IF NOT EXISTS idx_store_reviews_store_id ON public.store_reviews(store_id);
CREATE INDEX IF NOT EXISTS idx_store_reviews_user_id ON public.store_reviews(user_id);
