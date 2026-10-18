-- X post drafts and content-free creation receipts.
CREATE TABLE IF NOT EXISTS x_drafts (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  source_url TEXT,
  source_type TEXT NOT NULL DEFAULT 'other',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','posted','discarded')),
  posted_url TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS idx_x_drafts_status_created ON x_drafts(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_x_drafts_created ON x_drafts(created_at DESC);
CREATE TRIGGER IF NOT EXISTS x_drafts_revision AFTER UPDATE ON x_drafts
WHEN NEW.revision = OLD.revision
BEGIN
  UPDATE x_drafts SET revision=OLD.revision+1 WHERE id=NEW.id;
END;
CREATE TABLE IF NOT EXISTS x_draft_creates (
  key_hash TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  draft_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
