-- Ensure pgmq extension is available
create extension if not exists pgmq;

-- Create the review queue if it doesn't exist
-- We use exception handling instead of checking internal tables like q_meta which might vary by version
do $$
begin
    perform pgmq.create('review_queue');
exception
    when others then
        -- If it fails, assume it might already exist or print notice
        raise notice 'Queue creation returned error (could be already exists): %', SQLERRM;
end;
$$;

-- Function to get the next item for review
-- Returns the PGMQ message ID and the associated data
create or replace function public.get_next_review_item()
returns table (
    msg_id bigint,
    read_ct integer,
    enqueued_at timestamp with time zone,
    raw_feed_id uuid,
    scraped_data jsonb,
    candidate_id uuid,
    candidate_data jsonb,
    match_score float,
    match_reasons jsonb
)
language plpgsql
as $$
declare
    v_msg record;
    v_raw_feed record;
    v_candidate record;
begin
    -- 1. Read one message from the queue with visibility timeout (e.g., 5 minutes)
    -- We use dynamic SQL to avoid parse errors if pgmq extension is missing at parse time (though we created it)
    -- But standard call is fine if extension exists.
    select * from pgmq.read('review_queue', 300, 1) into v_msg;
    
    if v_msg.msg_id is null then
        return;
    end if;

    -- 2. Extract raw_feed_id from payload
    -- Payload expected format: { "raw_feed_id": "..." }
    declare
        v_target_id uuid;
    begin
        v_target_id := (v_msg.message->>'raw_feed_id')::uuid;
        
        -- 3. Fetch Raw Feed Data
        select * from public.raw_feed where id = v_target_id into v_raw_feed;
        
        -- 4. Fetch Candidate Data
        if v_raw_feed.match_candidate_id is not null then
            select * from public.products_canonical where id = v_raw_feed.match_candidate_id into v_candidate;
        end if;

        -- Return composite result
        msg_id := v_msg.msg_id;
        read_ct := v_msg.read_ct;
        enqueued_at := v_msg.enqueued_at;
        raw_feed_id := v_raw_feed.id;
        scraped_data := v_raw_feed.payload;
        candidate_id := v_candidate.id;
        candidate_data := v_candidate.specifications;
        match_score := v_raw_feed.match_score;
        match_reasons := '[]'::jsonb; 
        
        return next;
    end;
end;
$$;

-- Function to resolve a review item
create or replace function public.resolve_review_item(
    p_msg_id bigint,
    p_decision text, -- 'MATCH', 'REJECT', 'NEW_PRODUCT'
    p_raw_feed_id uuid
)
returns void
language plpgsql
as $$
declare
    v_raw_feed record;
begin
    -- Verify the item exists
    select * from public.raw_feed where id = p_raw_feed_id into v_raw_feed;
    
    if p_decision = 'MATCH' then
        -- 1. Update Raw Feed Status
        update public.raw_feed 
        set processing_status = 'MATCHED',
            updated_at = now()
        where id = p_raw_feed_id;

        -- 2. Archive message
        perform pgmq.archive('review_queue', p_msg_id);
        
    elsif p_decision = 'REJECT' then
        -- 1. Update status
        update public.raw_feed 
        set processing_status = 'FAILED', 
            match_candidate_id = null,
            match_score = null,
            updated_at = now()
        where id = p_raw_feed_id;
        
        -- 2. Archive message (or delete)
        perform pgmq.delete('review_queue', p_msg_id);
    end if;
end;
$$;
