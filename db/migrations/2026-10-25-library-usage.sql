-- Private, single-admin usage state. Never changes content revisions or public snapshots.
CREATE TABLE admin_recent_items (
  kind TEXT NOT NULL, item_id TEXT NOT NULL, viewed_at INTEGER NOT NULL,
  PRIMARY KEY(kind,item_id)
);
CREATE INDEX admin_recent_items_order ON admin_recent_items(viewed_at DESC);
CREATE TABLE admin_recent_searches (
  query_key TEXT PRIMARY KEY, query_json TEXT NOT NULL, used_at INTEGER NOT NULL
);
CREATE TABLE admin_collection_preferences (
  collection_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  pinned INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE library_member_preferences (
  collection_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, item_id TEXT NOT NULL, pinned INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(collection_id,kind,item_id)
);
