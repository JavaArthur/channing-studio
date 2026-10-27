-- Portfolio projects: one source for the public /work page and the private project hub.
-- `projects` stays dedicated to library collections. Apply once, after a D1 backup.
CREATE TABLE IF NOT EXISTS portfolio_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','maintained','paused','archived')),
  tags TEXT,
  site_url TEXT,
  repo_url TEXT,
  repo_public INTEGER NOT NULL DEFAULT 0,
  -- Private quick links (staging, consoles, docs) and the local checkout path never enter the public payload.
  links TEXT,
  local_path TEXT,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published_payload TEXT,
  published_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS idx_portfolio_projects_order ON portfolio_projects(is_pinned DESC, sort_order, updated_at DESC);

-- Carry over what /work showed before: studio_projects settings and legacy published collection snapshots.
INSERT OR IGNORE INTO portfolio_projects (slug,title,summary,tags,site_url,sort_order,published_payload,published_at)
SELECT json_extract(p.value,'$.id'), json_extract(p.value,'$.title'), json_extract(p.value,'$.description'),
  json_extract(p.value,'$.tags'), json_extract(p.value,'$.href'), p.key,
  CASE WHEN json_extract(p.value,'$.visible') = 0 THEN NULL ELSE json_object(
    'slug',json_extract(p.value,'$.id'),'title',json_extract(p.value,'$.title'),
    'summary',json_extract(p.value,'$.description'),'status','active',
    'tags',json(COALESCE(json_extract(p.value,'$.tags'),'[]')),
    'site_url',json_extract(p.value,'$.href'),'repo_url',NULL) END,
  CASE WHEN json_extract(p.value,'$.visible') = 0 THEN NULL ELSE strftime('%s','now') END
FROM site_settings s, json_each(s.value) p
WHERE s.key='studio_projects' AND json_valid(s.value)
  AND json_extract(p.value,'$.id') IS NOT NULL AND json_extract(p.value,'$.title') IS NOT NULL;

INSERT OR IGNORE INTO portfolio_projects (slug,title,summary,site_url,published_payload,published_at)
SELECT 'legacy-' || substr(id,1,8), json_extract(published_payload,'$.title'),
  json_extract(published_payload,'$.description'), json_extract(published_payload,'$.href'),
  json_object('slug','legacy-' || substr(id,1,8),'title',json_extract(published_payload,'$.title'),
    'summary',json_extract(published_payload,'$.description'),'status','active','tags',json('[]'),
    'site_url',json_extract(published_payload,'$.href'),'repo_url',NULL),
  strftime('%s','now')
FROM projects
WHERE published_payload IS NOT NULL AND json_valid(published_payload)
  AND json_extract(published_payload,'$.title') IS NOT NULL;
