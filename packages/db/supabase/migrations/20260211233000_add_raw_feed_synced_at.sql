-- Add synced_at column to raw_feed to track sync status to listings
alter table public.raw_feed
add column if not exists synced_at timestamp with time zone;

-- Index for finding unsynced matched items
create index if not exists idx_raw_feed_synced_status 
on public.raw_feed(processing_status, synced_at) 
where processing_status = 'MATCHED' and synced_at is null;
