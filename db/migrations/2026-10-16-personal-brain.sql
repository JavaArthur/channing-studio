-- Apply once, after the existing Studio schema has been inventoried and backed up.
ALTER TABLE posts ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
CREATE TABLE post_working_copies (
  post_id INTEGER PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  payload TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  base_revision INTEGER NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
ALTER TABLE tools ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 1;
ALTER TABLE tools ADD COLUMN published_payload TEXT;
UPDATE tools SET is_hidden = 0, published_payload = json_object('name',name,'url',url,'type',type,'description',description,'tags',tags,'icon',icon,'is_pinned',is_pinned,'sort_order',sort_order);
ALTER TABLE prompts ADD COLUMN published_payload TEXT;
UPDATE prompts SET published_payload = json_object('title',title,'description',description,'prompt',prompt,'category',category,'tags',tags,'source_url',source_url,'is_pinned',is_pinned,'sort_order',sort_order) WHERE is_hidden = 0;
CREATE TABLE inbox_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'inbox' CHECK(status IN ('inbox','organized','archived')),
  target_type TEXT,
  target_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  source_url TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  next_action TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','done','archived')),
  public_url TEXT,
  published_payload TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE TABLE project_links (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('note','post','tool','prompt')),
  target_id TEXT NOT NULL,
  PRIMARY KEY(project_id,kind,target_id)
);
CREATE INDEX idx_inbox_status_updated ON inbox_items(status,updated_at DESC);
CREATE INDEX idx_notes_updated ON notes(updated_at DESC);
CREATE INDEX idx_projects_status_updated ON projects(status,updated_at DESC);
