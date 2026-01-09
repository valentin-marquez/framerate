alter table "public"."profiles" add column "lang" text not null default 'es' check (lang in ('es', 'en', 'arn'));
