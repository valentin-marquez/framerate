-- Function to enqueue an item for review
-- This wrapper allows the client (Cortex) to push to the queue without direct access to pgmq schema
create or replace function public.enqueue_review_item(
    p_raw_feed_id uuid
)
returns bigint
language plpgsql
security definer -- Run as owner (postgres) to ensure access to pgmq
as $$
declare
    v_msg_id bigint;
begin
    -- Send message to review_queue
    select * from pgmq.send(
        'review_queue',
        jsonb_build_object('raw_feed_id', p_raw_feed_id)
    ) into v_msg_id;
    
    return v_msg_id;
end;
$$;

-- Grant execution permission
grant execute on function public.enqueue_review_item(uuid) to service_role;
-- Anon shouldn't allow enqueuing arbitrarily, maybe authenticated?
-- For Cortex (service_role), this is enough.
