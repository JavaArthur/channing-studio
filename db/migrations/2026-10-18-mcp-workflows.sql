-- Apply once after a production backup and recovery rehearsal.
-- No content or credentials: receipts bind one logical workflow to its input versions.
CREATE TABLE agent_brain_workflows (
  key_hash TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  execution_id TEXT NOT NULL,
  inbox_id TEXT NOT NULL,
  note_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  created_note INTEGER NOT NULL CHECK(created_note IN (0,1)),
  added_link INTEGER NOT NULL CHECK(added_link IN (0,1)),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
