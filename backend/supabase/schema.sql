-- ElonGoat schema (Supabase/Postgres)
-- Safe to run multiple times (idempotent-ish).
-- Run in Supabase SQL Editor.

create extension if not exists pgcrypto;

create schema if not exists elongoat;

-- Shared updated_at trigger
create or replace function elongoat.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------------------------
-- Variables
-- -----------------------------------------------------------------------------------------------

create table if not exists elongoat.variables (
  key varchar(100) primary key,
  value text not null,
  type varchar(50) not null default 'string',
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_variables_updated_at on elongoat.variables;
create trigger trg_variables_updated_at
before update on elongoat.variables
for each row execute procedure elongoat.set_updated_at();

-- -----------------------------------------------------------------------------------------------
-- PAA (People Also Ask) tree
-- -----------------------------------------------------------------------------------------------

create table if not exists elongoat.paa_tree (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text,
  slug varchar(255) unique not null,
  parent_id uuid references elongoat.paa_tree(id) on delete set null,
  level integer not null default 0,
  volume integer not null default 0,
  source_url text,
  source_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists paa_tree_parent_id_idx on elongoat.paa_tree(parent_id);
create index if not exists paa_tree_volume_idx on elongoat.paa_tree(volume desc);
create index if not exists paa_tree_slug_idx on elongoat.paa_tree(slug);

drop trigger if exists trg_paa_tree_updated_at on elongoat.paa_tree;
create trigger trg_paa_tree_updated_at
before update on elongoat.paa_tree
for each row execute procedure elongoat.set_updated_at();

-- -----------------------------------------------------------------------------------------------
-- SEO Clusters (site architecture)
-- -----------------------------------------------------------------------------------------------

create table if not exists elongoat.cluster_pages (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  topic_slug varchar(255) not null,
  page text not null,
  page_slug varchar(255) not null,
  slug varchar(511) unique not null, -- topic_slug/page_slug
  page_type text,
  seed_keyword text,
  tags text,
  keyword_count integer not null default 0,
  max_volume integer not null default 0,
  total_volume integer not null default 0,
  min_kd integer,
  max_kd integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cluster_pages_topic_slug_idx on elongoat.cluster_pages(topic_slug);
create index if not exists cluster_pages_max_volume_idx on elongoat.cluster_pages(max_volume desc);
create index if not exists cluster_pages_slug_idx on elongoat.cluster_pages(slug);

drop trigger if exists trg_cluster_pages_updated_at on elongoat.cluster_pages;
create trigger trg_cluster_pages_updated_at
before update on elongoat.cluster_pages
for each row execute procedure elongoat.set_updated_at();

create table if not exists elongoat.cluster_keywords (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references elongoat.cluster_pages(id) on delete cascade,
  keyword text not null,
  volume integer not null default 0,
  difficulty integer not null default 0,
  cpc numeric,
  competitive_density numeric,
  intent text,
  serp_features text,
  trend text,
  click_potential text,
  content_references jsonb,
  competitors jsonb,
  created_at timestamptz not null default now(),
  unique(page_id, keyword)
);

create index if not exists cluster_keywords_page_id_idx on elongoat.cluster_keywords(page_id);
create index if not exists cluster_keywords_volume_idx on elongoat.cluster_keywords(volume desc);

-- -----------------------------------------------------------------------------------------------
-- Keyword metrics (broad match / KE)
-- -----------------------------------------------------------------------------------------------

create table if not exists elongoat.keyword_metrics (
  keyword text not null,
  source text not null,
  intent text,
  volume integer not null default 0,
  difficulty integer not null default 0,
  cpc numeric,
  serp_features text,
  updated_at timestamptz not null default now(),
  primary key (keyword, source)
);

create index if not exists keyword_metrics_volume_idx on elongoat.keyword_metrics(volume desc);

drop trigger if exists trg_keyword_metrics_updated_at on elongoat.keyword_metrics;
create trigger trg_keyword_metrics_updated_at
before update on elongoat.keyword_metrics
for each row execute procedure elongoat.set_updated_at();

-- -----------------------------------------------------------------------------------------------
-- AI content cache (generated markdown)
-- -----------------------------------------------------------------------------------------------

create table if not exists elongoat.content_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text unique not null,
  kind text not null, -- 'cluster' | 'paa' | 'fact' | ...
  slug text not null,
  model text,
  content_md text not null,
  sources jsonb,
  generated_at timestamptz not null default now(),
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists content_cache_kind_slug_idx on elongoat.content_cache(kind, slug);
create index if not exists content_cache_expires_idx on elongoat.content_cache(expires_at);

drop trigger if exists trg_content_cache_updated_at on elongoat.content_cache;
create trigger trg_content_cache_updated_at
before update on elongoat.content_cache
for each row execute procedure elongoat.set_updated_at();

-- -----------------------------------------------------------------------------------------------
-- Videos (Google Videos -> YouTube) + transcripts
-- -----------------------------------------------------------------------------------------------

create table if not exists elongoat.youtube_videos (
  id uuid primary key default gen_random_uuid(),
  video_id text unique not null,
  title text,
  link text,
  channel text,
  snippet text,
  published_at timestamptz,
  duration text,
  thumbnail text,
  source_query text,
  scraped_at timestamptz not null default now()
);

create index if not exists youtube_videos_scraped_at_idx on elongoat.youtube_videos(scraped_at desc);

create table if not exists elongoat.youtube_transcripts (
  id uuid primary key default gen_random_uuid(),
  video_id text unique not null references elongoat.youtube_videos(video_id) on delete cascade,
  language text,
  transcript_text text,
  transcript_json jsonb,
  fetched_at timestamptz not null default now()
);

create index if not exists youtube_transcripts_fetched_at_idx on elongoat.youtube_transcripts(fetched_at desc);

-- -----------------------------------------------------------------------------------------------
-- X (Twitter) monitoring (optional / high risk; scraping may break)
-- -----------------------------------------------------------------------------------------------

create table if not exists elongoat.x_tweets (
  id uuid primary key default gen_random_uuid(),
  handle text not null,
  tweet_id text unique not null,
  url text,
  content text,
  posted_at timestamptz,
  scraped_at timestamptz not null default now(),
  raw jsonb
);

create index if not exists x_tweets_scraped_at_idx on elongoat.x_tweets(scraped_at desc);

create table if not exists elongoat.x_following (
  id uuid primary key default gen_random_uuid(),
  handle text not null,
  following_handle text not null,
  scraped_at timestamptz not null default now(),
  unique(handle, following_handle)
);

create index if not exists x_following_handle_idx on elongoat.x_following(handle);

-- -----------------------------------------------------------------------------------------------
-- Chat analytics (no chat history; aggregated counts only)
-- -----------------------------------------------------------------------------------------------

create table if not exists elongoat.chat_question_stats (
  question_hash text primary key,
  question text not null,
  count integer not null default 0,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  sample_page text,
  promoted_slug text,
  promoted_at timestamptz
);

create index if not exists chat_question_stats_count_idx on elongoat.chat_question_stats(count desc);
create index if not exists chat_question_stats_last_seen_idx on elongoat.chat_question_stats(last_seen_at desc);

-- -----------------------------------------------------------------------------------------------
-- Custom Q&A pages (chat-to-content flywheel)
-- -----------------------------------------------------------------------------------------------

create table if not exists elongoat.custom_qas (
  slug text primary key,
  question text not null,
  answer_md text not null,
  model text,
  sources jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists custom_qas_created_at_idx on elongoat.custom_qas(created_at desc);

drop trigger if exists trg_custom_qas_updated_at on elongoat.custom_qas;
create trigger trg_custom_qas_updated_at
before update on elongoat.custom_qas
for each row execute procedure elongoat.set_updated_at();

-- -----------------------------------------------------------------------------------------------
-- Grants (Supabase roles)
-- -----------------------------------------------------------------------------------------------

do $$
begin
  -- Supabase creates roles like anon/authenticated/service_role.
  -- Local Postgres (dev) usually doesn't have them, so guard the grants.
  if exists(select 1 from pg_roles where rolname = 'anon') then
    grant usage on schema elongoat to anon;
    grant all on all tables in schema elongoat to anon;
  end if;

  if exists(select 1 from pg_roles where rolname = 'authenticated') then
    grant usage on schema elongoat to authenticated;
    grant all on all tables in schema elongoat to authenticated;
  end if;

  if exists(select 1 from pg_roles where rolname = 'service_role') then
    grant usage on schema elongoat to service_role;
    grant all on all tables in schema elongoat to service_role;
  end if;

  -- Always safe on standard Postgres.
  grant usage on schema elongoat to postgres;
  grant all on all tables in schema elongoat to postgres;
end $$;
