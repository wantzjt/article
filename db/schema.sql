-- Neon schema for CitationForge. Apply with `npm run db:migrate` when DATABASE_URL is set.
CREATE TABLE IF NOT EXISTS topics (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  entity_type text NOT NULL,
  description text NOT NULL DEFAULT '',
  aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
  official_domains jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'stub',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz,
  last_material_change_at timestamptz,
  kind text
);

CREATE TABLE IF NOT EXISTS sources (
  id text PRIMARY KEY,
  canonical_url text NOT NULL UNIQUE,
  title text NOT NULL,
  publisher text NOT NULL,
  publisher_domain text NOT NULL,
  author text,
  published_at timestamptz,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  source_type text NOT NULL,
  primary_status text NOT NULL,
  content_hash text NOT NULL,
  evidence_excerpt text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS claims (
  id text PRIMARY KEY,
  topic_id text NOT NULL REFERENCES topics(id),
  claim_text text NOT NULL,
  normalized_claim text NOT NULL,
  status text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS claims_topic_normalized_active
  ON claims (topic_id, normalized_claim)
  WHERE superseded_at IS NULL;

CREATE TABLE IF NOT EXISTS claim_sources (
  claim_id text NOT NULL REFERENCES claims(id),
  source_id text NOT NULL REFERENCES sources(id),
  support_type text NOT NULL,
  evidence_excerpt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (claim_id, source_id, support_type)
);

CREATE TABLE IF NOT EXISTS briefs (
  id text PRIMARY KEY,
  topic_id text NOT NULL REFERENCES topics(id),
  slug text NOT NULL UNIQUE,
  headline text NOT NULL,
  summary text NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  published_at timestamptz NOT NULL,
  status text NOT NULL,
  render_data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS topic_versions (
  id text PRIMARY KEY,
  topic_id text NOT NULL REFERENCES topics(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  material_hash text NOT NULL,
  claim_snapshot jsonb NOT NULL,
  change_summary text NOT NULL,
  UNIQUE (topic_id, material_hash)
);

CREATE TABLE IF NOT EXISTS ai_spend_events (
  id text PRIMARY KEY,
  day date NOT NULL,
  stage text NOT NULL,
  topic_id text,
  model text NOT NULL,
  cost_usd numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id text PRIMARY KEY,
  topic_id text NOT NULL,
  status text NOT NULL,
  stages jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE topics ADD COLUMN IF NOT EXISTS kind text;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS entity_meta jsonb NOT NULL DEFAULT '{}'::jsonb;
