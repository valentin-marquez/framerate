-- Profile bio. Capped at 280 chars for tweet-length brevity.
alter table "public"."profiles"
    add column "bio" text check (bio is null or char_length(bio) <= 280);
