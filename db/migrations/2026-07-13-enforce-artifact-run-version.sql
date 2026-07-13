-- Rebuild the projection table so every artifact has valid run provenance.
-- This intentionally fails instead of inventing provenance if legacy rows still have NULL last_run_id.

CREATE TABLE knowledge_artifacts_versioned (
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
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  last_run_id TEXT NOT NULL,
  FOREIGN KEY(last_run_id) REFERENCES agent_sync_runs(id)
);

INSERT INTO knowledge_artifacts_versioned (
  artifact_key, type, domain, stage, title, summary, source_ids_json,
  target_path, public_url, status, first_seen_at, updated_at, last_run_id
)
SELECT
  artifact_key, type, domain, stage, title, summary, source_ids_json,
  target_path, public_url, status, first_seen_at, updated_at, last_run_id
FROM knowledge_artifacts;

DROP TABLE knowledge_artifacts;
ALTER TABLE knowledge_artifacts_versioned RENAME TO knowledge_artifacts;

CREATE INDEX idx_knowledge_artifacts_type_status
  ON knowledge_artifacts(type, status, updated_at DESC);
CREATE INDEX idx_knowledge_artifacts_domain
  ON knowledge_artifacts(domain, updated_at DESC);
CREATE INDEX idx_knowledge_artifacts_last_run
  ON knowledge_artifacts(last_run_id);
