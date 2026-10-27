-- Apply once, after a D1 backup and a migration rehearsal.
ALTER TABLE x_drafts ADD COLUMN account_id TEXT NOT NULL DEFAULT 'ai'
  CHECK(account_id IN ('ai','bg'));
ALTER TABLE x_drafts ADD COLUMN edited_content TEXT;
CREATE INDEX idx_x_drafts_account_status_created ON x_drafts(account_id,status,created_at DESC);
