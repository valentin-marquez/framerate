-- Grant permissions for pgmq schema usage
grant usage on schema pgmq to postgres, anon, authenticated, service_role;
grant all on all tables in schema pgmq to postgres, anon, authenticated, service_role;
grant all on all sequences in schema pgmq to postgres, anon, authenticated, service_role;
grant all on all routines in schema pgmq to postgres, anon, authenticated, service_role;

-- Specifically for the review_queue table (named 'review_queue' or 'pgmq.review_queue'?)
-- PGMQ creates tables in `public` or `pgmq` depending on config but usually `pgmq.q_review_queue`?
-- Let's just grant on all tables in public to be safe if it put it there, though we likely already have that.
-- And specifically for our wrapper functions
grant execute on function public.get_next_review_item() to anon, authenticated, service_role;
grant execute on function public.resolve_review_item(bigint, text, uuid) to anon, authenticated, service_role;
