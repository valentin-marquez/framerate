-- Translation feedback table: lets users propose corrections for any
-- translation key. Inserts are open (so anon visitors can also contribute);
-- reads are restricted to the service role for moderation.

create table "public"."translation_feedback" (
    "id" uuid primary key default gen_random_uuid(),
    "user_id" uuid references auth.users(id) on delete set null,
    "lang" text not null check (lang in ('es', 'en', 'arn')),
    "translation_key" text not null,
    "current_text" text not null,
    "suggested_text" text not null,
    "comment" text,
    "context_url" text,
    "user_agent" text,
    "created_at" timestamptz not null default now()
);

create index "translation_feedback_lang_idx" on "public"."translation_feedback" (lang, created_at desc);
create index "translation_feedback_key_idx" on "public"."translation_feedback" (translation_key);
create index "translation_feedback_user_idx" on "public"."translation_feedback" (user_id) where user_id is not null;

alter table "public"."translation_feedback" enable row level security;

-- Anyone (including anon) may insert. Light constraints prevent abuse:
-- key + suggestion limited length enforced at DB; rate-limit at API.
create policy "translation_feedback_insert_public"
    on "public"."translation_feedback"
    for insert
    to anon, authenticated
    with check (
        length(translation_key) between 1 and 200
        and length(current_text) between 1 and 2000
        and length(suggested_text) between 1 and 2000
        and (comment is null or length(comment) <= 2000)
        and (context_url is null or length(context_url) <= 1000)
    );

-- No select / update / delete policies = nothing readable through anon/authed
-- keys. Only the service role bypasses RLS for moderation.
