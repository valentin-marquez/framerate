-- Add index on raw_feed(external_id) for faster lookups/deduplication
create index if not exists idx_raw_feed_external_id on public.raw_feed(external_id);

-- Add composite index on source + external_id for specific retailer lookups
create index if not exists idx_raw_feed_source_external_id on public.raw_feed(source, external_id);
