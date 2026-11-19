-- 2026-11-19: Performance indexes and library_post_update trigger narrowing
-- Apply after backing up D1.

-- Narrow library_post_update so view_count increments do not write to library_metadata
-- or bump revision on every article view.
DROP TRIGGER IF EXISTS library_post_update;
CREATE TRIGGER library_post_update
AFTER UPDATE OF slug, title, content, description, category, tags, status, source_url, is_hidden, deleted_at ON posts
BEGIN
  INSERT INTO library_metadata(kind,item_id) VALUES ('post',CAST(NEW.slug AS TEXT))
  ON CONFLICT(kind,item_id) DO UPDATE SET revision=revision+1;
END;

-- Partial composite index for public post feeds
CREATE INDEX IF NOT EXISTS idx_posts_public_feed
  ON posts(is_pinned DESC, published_at DESC)
  WHERE status = 'published' AND deleted_at IS NULL AND password IS NULL AND is_hidden = 0;

-- Covering index on library_metadata for faster workbench filtering
CREATE INDEX IF NOT EXISTS idx_library_meta_filter
  ON library_metadata(archived, favorite, kind, item_id);
