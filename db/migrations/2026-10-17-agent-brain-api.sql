-- Apply once after backing up the existing personal-brain production database.
ALTER TABLE inbox_items ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE notes ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE projects ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;

-- Existing admin writes also invalidate the Agent's version, including same-second edits.
CREATE TRIGGER inbox_items_revision AFTER UPDATE ON inbox_items
WHEN NEW.revision = OLD.revision
BEGIN
  UPDATE inbox_items SET revision=OLD.revision+1 WHERE id=NEW.id;
END;
CREATE TRIGGER notes_revision AFTER UPDATE ON notes
WHEN NEW.revision = OLD.revision
BEGIN
  UPDATE notes SET revision=OLD.revision+1 WHERE id=NEW.id;
END;
CREATE TRIGGER projects_revision AFTER UPDATE ON projects
WHEN NEW.revision = OLD.revision
BEGIN
  UPDATE projects SET revision=OLD.revision+1 WHERE id=NEW.id;
END;
CREATE TRIGGER project_links_revision_insert AFTER INSERT ON project_links
BEGIN
  UPDATE projects SET updated_at=strftime('%s','now') WHERE id=NEW.project_id;
END;
CREATE TRIGGER project_links_revision_delete AFTER DELETE ON project_links
BEGIN
  UPDATE projects SET updated_at=strftime('%s','now') WHERE id=OLD.project_id;
END;

-- Persist creation receipts; never store the authentication token or source content here.
CREATE TABLE agent_brain_creates (
  key_hash TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('inbox','notes','projects')),
  request_hash TEXT NOT NULL,
  item_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
