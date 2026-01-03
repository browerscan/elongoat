-- ElonGoat pgvector migration
-- Adds vector search capability using pgvector extension
-- Run after schema.sql

-- Enable pgvector extension (requires superuser on first install)
create extension if not exists vector;

-- -----------------------------------------------------------------------------------------------
-- Add embedding columns to content tables
-- Using 1536 dimensions (OpenAI text-embedding-3-small / ada-002 compatible)
-- Can also support 3072 dimensions (text-embedding-3-large) by changing vector size
-- -----------------------------------------------------------------------------------------------

-- Add embedding column to content_cache
alter table elongoat.content_cache
  add column if not exists embedding vector(1536);

-- Add embedding column to paa_tree
alter table elongoat.paa_tree
  add column if not exists embedding vector(1536);

-- Add embedding column to cluster_pages
alter table elongoat.cluster_pages
  add column if not exists embedding vector(1536);

-- -----------------------------------------------------------------------------------------------
-- Create HNSW indexes for fast approximate nearest neighbor search
-- HNSW is faster for queries, IVFFlat is faster for inserts
-- -----------------------------------------------------------------------------------------------

-- Index for content_cache embeddings
create index if not exists content_cache_embedding_idx
  on elongoat.content_cache
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Index for paa_tree embeddings
create index if not exists paa_tree_embedding_idx
  on elongoat.paa_tree
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Index for cluster_pages embeddings
create index if not exists cluster_pages_embedding_idx
  on elongoat.cluster_pages
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- -----------------------------------------------------------------------------------------------
-- Vector search functions
-- -----------------------------------------------------------------------------------------------

-- Search content_cache by embedding similarity
create or replace function elongoat.search_content_cache_by_embedding(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 10
)
returns table (
  id uuid,
  slug text,
  kind text,
  content_md text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    cc.id,
    cc.slug,
    cc.kind,
    cc.content_md,
    1 - (cc.embedding <=> query_embedding) as similarity
  from elongoat.content_cache cc
  where cc.embedding is not null
    and 1 - (cc.embedding <=> query_embedding) > match_threshold
  order by cc.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Search paa_tree by embedding similarity
create or replace function elongoat.search_paa_by_embedding(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 10
)
returns table (
  id uuid,
  question text,
  answer text,
  slug varchar,
  volume int,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    p.id,
    p.question,
    p.answer,
    p.slug,
    p.volume,
    1 - (p.embedding <=> query_embedding) as similarity
  from elongoat.paa_tree p
  where p.embedding is not null
    and 1 - (p.embedding <=> query_embedding) > match_threshold
  order by p.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Search cluster_pages by embedding similarity
create or replace function elongoat.search_clusters_by_embedding(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 10
)
returns table (
  id uuid,
  topic text,
  page text,
  slug varchar,
  seed_keyword text,
  max_volume int,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    cp.id,
    cp.topic,
    cp.page,
    cp.slug,
    cp.seed_keyword,
    cp.max_volume,
    1 - (cp.embedding <=> query_embedding) as similarity
  from elongoat.cluster_pages cp
  where cp.embedding is not null
    and 1 - (cp.embedding <=> query_embedding) > match_threshold
  order by cp.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Hybrid search: combines full-text and vector similarity
create or replace function elongoat.hybrid_search(
  search_query text,
  query_embedding vector(1536),
  full_text_weight float default 0.5,
  semantic_weight float default 0.5,
  match_count int default 10
)
returns table (
  source_type text,
  id uuid,
  title text,
  content text,
  slug text,
  combined_score float
)
language plpgsql
as $$
begin
  return query
  with ranked_results as (
    -- Content cache results
    select
      'content_cache' as source_type,
      cc.id,
      coalesce(
        substring(cc.content_md from '^#\s+(.+)$'),
        replace(replace(cc.slug, '-', ' '), '/', ' - ')
      ) as title,
      left(cc.content_md, 500) as content,
      cc.slug,
      (
        coalesce(ts_rank_cd(
          to_tsvector('english', cc.content_md || ' ' || cc.slug),
          plainto_tsquery('english', search_query)
        ), 0) * full_text_weight
        +
        case when cc.embedding is not null
          then (1 - (cc.embedding <=> query_embedding)) * semantic_weight
          else 0
        end
      ) as combined_score
    from elongoat.content_cache cc
    where
      to_tsvector('english', cc.content_md || ' ' || cc.slug) @@ plainto_tsquery('english', search_query)
      or (cc.embedding is not null and 1 - (cc.embedding <=> query_embedding) > 0.5)

    union all

    -- PAA results
    select
      'paa' as source_type,
      p.id,
      p.question as title,
      coalesce(p.answer, 'No answer available') as content,
      p.slug::text,
      (
        coalesce(ts_rank_cd(
          to_tsvector('english', p.question || ' ' || coalesce(p.answer, '')),
          plainto_tsquery('english', search_query)
        ), 0) * full_text_weight
        +
        case when p.embedding is not null
          then (1 - (p.embedding <=> query_embedding)) * semantic_weight
          else 0
        end
      ) as combined_score
    from elongoat.paa_tree p
    where
      to_tsvector('english', p.question || ' ' || coalesce(p.answer, '')) @@ plainto_tsquery('english', search_query)
      or (p.embedding is not null and 1 - (p.embedding <=> query_embedding) > 0.5)

    union all

    -- Cluster results
    select
      'cluster' as source_type,
      cp.id,
      cp.page as title,
      'Topic: ' || cp.topic || coalesce('. Primary keyword: ' || cp.seed_keyword, '') as content,
      cp.slug::text,
      (
        coalesce(ts_rank_cd(
          to_tsvector('english', cp.topic || ' ' || cp.page || ' ' || coalesce(cp.seed_keyword, '')),
          plainto_tsquery('english', search_query)
        ), 0) * full_text_weight
        +
        case when cp.embedding is not null
          then (1 - (cp.embedding <=> query_embedding)) * semantic_weight
          else 0
        end
      ) as combined_score
    from elongoat.cluster_pages cp
    where
      to_tsvector('english', cp.topic || ' ' || cp.page || ' ' || coalesce(cp.seed_keyword, '')) @@ plainto_tsquery('english', search_query)
      or (cp.embedding is not null and 1 - (cp.embedding <=> query_embedding) > 0.5)
  )
  select *
  from ranked_results
  where combined_score > 0
  order by combined_score desc
  limit match_count;
end;
$$;

-- Grant permissions
do $$
begin
  if exists(select 1 from pg_roles where rolname = 'anon') then
    grant execute on function elongoat.search_content_cache_by_embedding to anon;
    grant execute on function elongoat.search_paa_by_embedding to anon;
    grant execute on function elongoat.search_clusters_by_embedding to anon;
    grant execute on function elongoat.hybrid_search to anon;
  end if;

  if exists(select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function elongoat.search_content_cache_by_embedding to authenticated;
    grant execute on function elongoat.search_paa_by_embedding to authenticated;
    grant execute on function elongoat.search_clusters_by_embedding to authenticated;
    grant execute on function elongoat.hybrid_search to authenticated;
  end if;

  if exists(select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function elongoat.search_content_cache_by_embedding to service_role;
    grant execute on function elongoat.search_paa_by_embedding to service_role;
    grant execute on function elongoat.search_clusters_by_embedding to service_role;
    grant execute on function elongoat.hybrid_search to service_role;
  end if;

  grant execute on function elongoat.search_content_cache_by_embedding to postgres;
  grant execute on function elongoat.search_paa_by_embedding to postgres;
  grant execute on function elongoat.search_clusters_by_embedding to postgres;
  grant execute on function elongoat.hybrid_search to postgres;
end $$;
