-- Add run-order provenance so delayed Hermes runs cannot overwrite newer artifacts.

ALTER TABLE knowledge_artifacts ADD COLUMN last_run_id TEXT REFERENCES agent_sync_runs(id);

CREATE INDEX IF NOT EXISTS idx_knowledge_artifacts_last_run
  ON knowledge_artifacts(last_run_id);
