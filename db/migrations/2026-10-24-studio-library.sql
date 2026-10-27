-- Apply once, after backing up and rehearsing against the existing database.
-- Source content stays in its original tables; this adds private library metadata.
CREATE TABLE library_metadata (
  kind TEXT NOT NULL CHECK(kind IN ('note','inbox','tool','prompt','inspiration','artifact','post')),
  item_id TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT '',
  display_title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  saved_reason TEXT NOT NULL DEFAULT '',
  topics_json TEXT NOT NULL DEFAULT '[]',
  submitted_by TEXT NOT NULL DEFAULT 'unknown' CHECK(submitted_by IN ('unknown','agent','manual')),
  source_status TEXT NOT NULL DEFAULT 'unknown' CHECK(source_status IN ('unknown','available','unavailable')),
  decision_question TEXT NOT NULL DEFAULT '',
  favorite INTEGER NOT NULL DEFAULT 0 CHECK(favorite IN (0,1)),
  archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
  canonical_source TEXT,
  mutation_id TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(kind,item_id)
);
CREATE INDEX library_source_lookup ON library_metadata(kind,canonical_source);
CREATE TABLE library_captures (
  key_hash TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  execution_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  item_id TEXT NOT NULL,
  created INTEGER NOT NULL CHECK(created IN (0,1)),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE TABLE library_collection_links (
  collection_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('inbox','inspiration','artifact')),
  item_id TEXT NOT NULL,
  PRIMARY KEY(collection_id,kind,item_id)
);
CREATE TRIGGER library_metadata_revision AFTER UPDATE ON library_metadata
WHEN NEW.revision=OLD.revision BEGIN
  UPDATE library_metadata SET revision=OLD.revision+1 WHERE kind=NEW.kind AND item_id=NEW.item_id;
END;

INSERT INTO library_metadata(kind,item_id) SELECT 'note',CAST(id AS TEXT) FROM notes;
CREATE TRIGGER library_note_insert AFTER INSERT ON notes BEGIN
  INSERT OR IGNORE INTO library_metadata(kind,item_id) VALUES ('note',CAST(NEW.id AS TEXT));
END;
CREATE TRIGGER library_note_update AFTER UPDATE ON notes BEGIN
  INSERT INTO library_metadata(kind,item_id) VALUES ('note',CAST(NEW.id AS TEXT))
  ON CONFLICT(kind,item_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER library_note_delete AFTER DELETE ON notes BEGIN
  DELETE FROM library_metadata WHERE kind='note' AND item_id=CAST(OLD.id AS TEXT);
END;

INSERT INTO library_metadata(kind,item_id) SELECT 'inbox',CAST(id AS TEXT) FROM inbox_items;
CREATE TRIGGER library_inbox_insert AFTER INSERT ON inbox_items BEGIN
  INSERT OR IGNORE INTO library_metadata(kind,item_id) VALUES ('inbox',CAST(NEW.id AS TEXT));
END;
CREATE TRIGGER library_inbox_update AFTER UPDATE ON inbox_items BEGIN
  INSERT INTO library_metadata(kind,item_id) VALUES ('inbox',CAST(NEW.id AS TEXT))
  ON CONFLICT(kind,item_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER library_inbox_delete AFTER DELETE ON inbox_items BEGIN
  DELETE FROM library_metadata WHERE kind='inbox' AND item_id=CAST(OLD.id AS TEXT);
END;

INSERT INTO library_metadata(kind,item_id) SELECT 'tool',CAST(id AS TEXT) FROM tools;
CREATE TRIGGER library_tool_insert AFTER INSERT ON tools BEGIN
  INSERT OR IGNORE INTO library_metadata(kind,item_id) VALUES ('tool',CAST(NEW.id AS TEXT));
END;
CREATE TRIGGER library_tool_update AFTER UPDATE ON tools BEGIN
  INSERT INTO library_metadata(kind,item_id) VALUES ('tool',CAST(NEW.id AS TEXT))
  ON CONFLICT(kind,item_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER library_tool_delete AFTER DELETE ON tools BEGIN
  DELETE FROM library_metadata WHERE kind='tool' AND item_id=CAST(OLD.id AS TEXT);
END;

INSERT INTO library_metadata(kind,item_id) SELECT 'prompt',CAST(id AS TEXT) FROM prompts;
CREATE TRIGGER library_prompt_insert AFTER INSERT ON prompts BEGIN
  INSERT OR IGNORE INTO library_metadata(kind,item_id) VALUES ('prompt',CAST(NEW.id AS TEXT));
END;
CREATE TRIGGER library_prompt_update AFTER UPDATE ON prompts BEGIN
  INSERT INTO library_metadata(kind,item_id) VALUES ('prompt',CAST(NEW.id AS TEXT))
  ON CONFLICT(kind,item_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER library_prompt_delete AFTER DELETE ON prompts BEGIN
  DELETE FROM library_metadata WHERE kind='prompt' AND item_id=CAST(OLD.id AS TEXT);
END;

INSERT INTO library_metadata(kind,item_id) SELECT 'inspiration',CAST(id AS TEXT) FROM x_drafts;
CREATE TRIGGER library_inspiration_insert AFTER INSERT ON x_drafts BEGIN
  INSERT OR IGNORE INTO library_metadata(kind,item_id) VALUES ('inspiration',CAST(NEW.id AS TEXT));
END;
CREATE TRIGGER library_inspiration_update AFTER UPDATE ON x_drafts BEGIN
  INSERT INTO library_metadata(kind,item_id) VALUES ('inspiration',CAST(NEW.id AS TEXT))
  ON CONFLICT(kind,item_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER library_inspiration_delete AFTER DELETE ON x_drafts BEGIN
  DELETE FROM library_metadata WHERE kind='inspiration' AND item_id=CAST(OLD.id AS TEXT);
END;

INSERT INTO library_metadata(kind,item_id) SELECT 'artifact',CAST(artifact_key AS TEXT) FROM knowledge_artifacts;
CREATE TRIGGER library_artifact_insert AFTER INSERT ON knowledge_artifacts BEGIN
  INSERT OR IGNORE INTO library_metadata(kind,item_id) VALUES ('artifact',CAST(NEW.artifact_key AS TEXT));
END;
CREATE TRIGGER library_artifact_update AFTER UPDATE ON knowledge_artifacts BEGIN
  INSERT INTO library_metadata(kind,item_id) VALUES ('artifact',CAST(NEW.artifact_key AS TEXT))
  ON CONFLICT(kind,item_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER library_artifact_delete AFTER DELETE ON knowledge_artifacts BEGIN
  DELETE FROM library_metadata WHERE kind='artifact' AND item_id=CAST(OLD.artifact_key AS TEXT);
END;

INSERT INTO library_metadata(kind,item_id) SELECT 'post',CAST(slug AS TEXT) FROM posts;
CREATE TRIGGER library_post_insert AFTER INSERT ON posts BEGIN
  INSERT OR IGNORE INTO library_metadata(kind,item_id) VALUES ('post',CAST(NEW.slug AS TEXT));
END;
CREATE TRIGGER library_post_update AFTER UPDATE ON posts BEGIN
  INSERT INTO library_metadata(kind,item_id) VALUES ('post',CAST(NEW.slug AS TEXT))
  ON CONFLICT(kind,item_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER library_post_delete AFTER DELETE ON posts BEGIN
  DELETE FROM library_metadata WHERE kind='post' AND item_id=CAST(OLD.slug AS TEXT);
END;

-- D1 limits each compound SELECT to five terms. LIMIT prevents flattening.
CREATE VIEW library_private_content AS
SELECT 'note' AS kind,id,title,content,source_url,created_at,updated_at,archived FROM notes
UNION ALL SELECT 'inbox',id,title,content,source_url,created_at,updated_at,status!='inbox' FROM inbox_items
UNION ALL SELECT 'tool',CAST(id AS TEXT),name,COALESCE(description,''),url,created_at,updated_at,0 FROM tools
UNION ALL SELECT 'prompt',CAST(id AS TEXT),title,prompt,source_url,created_at,updated_at,0 FROM prompts
UNION ALL SELECT 'inspiration',id,substr(content,1,80),content,source_url,created_at,updated_at,status='discarded' FROM x_drafts
;
CREATE VIEW library_content AS
SELECT * FROM (SELECT * FROM library_private_content LIMIT -1)
UNION ALL SELECT 'artifact',artifact_key,title,summary,public_url,first_seen_at,updated_at,status!='active' FROM knowledge_artifacts
UNION ALL SELECT 'post',slug,title,content,source_url,published_at,updated_at,deleted_at IS NOT NULL FROM posts;
CREATE VIEW library_members AS
SELECT project_id AS collection_id,kind,
 CASE WHEN kind='post' THEN COALESCE((SELECT slug FROM posts WHERE CAST(id AS TEXT)=target_id),target_id) ELSE target_id END AS item_id
FROM project_links
UNION ALL SELECT collection_id,kind,item_id FROM library_collection_links;
CREATE TRIGGER library_collection_insert AFTER INSERT ON library_collection_links BEGIN
  UPDATE projects SET updated_at=strftime('%s','now') WHERE id=NEW.collection_id;
END;
CREATE TRIGGER library_collection_delete AFTER DELETE ON library_collection_links BEGIN
  UPDATE projects SET updated_at=strftime('%s','now') WHERE id=OLD.collection_id;
END;
