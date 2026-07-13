-- Hermes / Flomo knowledge loop projection tables.
-- Only metadata, decisions and short summaries are stored here; never store raw memo text.

CREATE TABLE IF NOT EXISTS agent_sync_runs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK(source = 'flomo'),
  mode TEXT NOT NULL CHECK(mode IN ('hourly', 'nightly', 'reconcile')),
  status TEXT NOT NULL CHECK(status IN ('running', 'succeeded', 'blocked', 'failed')),
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  discovered_count INTEGER NOT NULL DEFAULT 0,
  selected_count INTEGER NOT NULL DEFAULT 0,
  artifact_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT CHECK(error_message IS NULL OR length(error_message) <= 500),
  snapshot_json TEXT,
  started_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  finished_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_agent_sync_runs_status_time
  ON agent_sync_runs(status, started_at DESC);

CREATE TABLE IF NOT EXISTS agent_source_items (
  source_id TEXT PRIMARY KEY,
  source_updated_at TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  decision TEXT NOT NULL CHECK(decision IN ('ignored', 'candidate', 'processed', 'blocked')),
  domain TEXT NOT NULL CHECK(domain IN ('work', 'investing', 'knowledge', 'content')),
  decision_reason TEXT NOT NULL CHECK(length(decision_reason) <= 300),
  first_seen_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  last_seen_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  processed_at INTEGER,
  last_run_id TEXT NOT NULL,
  FOREIGN KEY(last_run_id) REFERENCES agent_sync_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_agent_source_items_updated
  ON agent_source_items(source_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_source_items_decision
  ON agent_source_items(decision, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS knowledge_artifacts (
  artifact_key TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('knowledge', 'topic', 'draft', 'published')),
  domain TEXT NOT NULL CHECK(domain IN ('work', 'investing', 'knowledge', 'content')),
  stage TEXT NOT NULL,
  title TEXT NOT NULL CHECK(length(title) <= 200),
  summary TEXT NOT NULL CHECK(length(summary) <= 500),
  source_ids_json TEXT NOT NULL,
  target_path TEXT,
  public_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived', 'blocked')),
  first_seen_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_knowledge_artifacts_type_status
  ON knowledge_artifacts(type, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_artifacts_domain
  ON knowledge_artifacts(domain, updated_at DESC);
