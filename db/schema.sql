-- 文章表
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  html TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT '未分类',
  tags TEXT, -- JSON 数组字符串
  status TEXT DEFAULT 'published' CHECK(status IN ('draft', 'published', 'deleted')),
  password TEXT, -- 文章密码，NULL 表示公开
  is_pinned INTEGER DEFAULT 0, -- 是否置顶
  is_hidden INTEGER DEFAULT 0, -- 是否隐藏（unlisted）
  cover_image TEXT, -- 封面图 URL
  kind TEXT DEFAULT 'post', -- 内容类型：post（原创，进首页）/ clipping（剪报，进剪报区）
  source_url TEXT, -- 剪报原文出处，原创为 NULL
  deleted_at INTEGER, -- 软删除时间戳，NULL 表示未删除
  published_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  view_count INTEGER DEFAULT 0
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);
CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published_at DESC);

-- 全文搜索：FTS5 在 Cloudflare D1 上目前有 shadow table 损坏问题
-- (SQLITE_CORRUPT_VTAB, see emdash-cms/emdash#252). 源码层使用
-- lib/repositories/search.ts 中的 LIKE 回退已经足够覆盖正常使用，
-- 待 D1 对 FTS5 支持稳定后，可通过 db/migrations/enable-fts.sql 重新开启。
-- CREATE VIRTUAL TABLE posts_fts USING fts5(
--   title,
--   content,
--   content=posts,
--   content_rowid=id,
--   tokenize='unicode61'
-- );
--
-- CREATE TRIGGER posts_ai AFTER INSERT ON posts BEGIN
--   INSERT INTO posts_fts(rowid, title, content)
--   VALUES (new.id, new.title, new.content);
-- END;
--
-- CREATE TRIGGER posts_au AFTER UPDATE ON posts BEGIN
--   UPDATE posts_fts SET title = new.title, content = new.content
--   WHERE rowid = new.id;
-- END;
--
-- CREATE TRIGGER posts_ad AFTER DELETE ON posts BEGIN
--   DELETE FROM posts_fts WHERE rowid = old.id;
-- END;

-- 工具墙：收藏的小工具/仓库/Mac 软件/任意好东西
CREATE TABLE IF NOT EXISTS tools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT,                          -- 可空：other 类型未必有链接
  type TEXT NOT NULL DEFAULT 'url',  -- url / repo / mac-app / other
  description TEXT,                  -- 一句话：我为什么收它
  tags TEXT,                         -- JSON 数组字符串
  icon TEXT,                         -- favicon / 截图 URL
  is_pinned INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_tools_type ON tools(type);
CREATE INDEX IF NOT EXISTS idx_tools_pinned ON tools(is_pinned DESC, sort_order ASC, created_at DESC);

-- 分类统计表
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  post_count INTEGER DEFAULT 0
);

-- 站点设置表
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- AI 操作表：编辑器 Ask AI 面板的预设操作
CREATE TABLE IF NOT EXISTS ai_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action_key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  prompt TEXT NOT NULL,
  temperature REAL DEFAULT 0.6,
  sort_order INTEGER DEFAULT 0,
  is_enabled INTEGER DEFAULT 1,
  is_builtin INTEGER DEFAULT 1,
  profile_id INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

INSERT OR IGNORE INTO ai_actions
  (action_key, label, description, prompt, temperature, sort_order, is_builtin)
VALUES
  ('improve', '润色', '让表达更顺更自然',
   '你是专业的中文写作助手。对下面的文字进行润色，让表达更顺畅自然，保持原意、语气和信息密度不变，直接返回润色后的文字，不要解释。',
   0.6, 10, 1),
  ('shorten', '缩写', '压缩成更短版本',
   '你是专业的中文写作助手。在不丢失核心意思的前提下，把下面的文字压缩得更简短精炼，直接返回结果，不要解释。',
   0.6, 20, 1),
  ('expand', '扩写', '补充为更完整表述',
   '你是专业的中文写作助手。对下面的文字进行扩写，让表达更完整自然，保持原有风格和语气，直接返回结果，不要解释。',
   0.6, 30, 1),
  ('summarize', '总结', '提炼为清晰摘要',
   '你是专业的中文写作助手。把下面的文字总结为简洁清晰的摘要，直接返回结果，不要解释。',
   0.6, 40, 1),
  ('translate_zh', '译成中文', '翻成简体中文',
   '你是专业翻译。把下面的内容翻译成简体中文，保持原文风格，直接返回翻译结果，不要解释。',
   0.2, 50, 1),
  ('translate_en', '译成英文', '翻成自然英文',
   '你是专业翻译。把下面的内容翻译成自然流畅的英文，保持原文风格，直接返回翻译结果，不要解释。',
   0.2, 60, 1);

-- AI Provider 配置表（API Key 使用加密存储）
CREATE TABLE IF NOT EXISTS ai_provider_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'custom',
  provider_name TEXT NOT NULL DEFAULT '',
  provider_type TEXT NOT NULL DEFAULT 'openai_compatible',
  provider_category TEXT NOT NULL DEFAULT '',
  api_key_url TEXT NOT NULL DEFAULT '',
  base_url TEXT NOT NULL,
  model TEXT NOT NULL,
  temperature REAL NOT NULL DEFAULT 0.7,
  max_tokens INTEGER NOT NULL DEFAULT 2000,
  api_key_encrypted TEXT NOT NULL DEFAULT '',
  api_key_masked TEXT NOT NULL DEFAULT '',
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- 文章元数据生成器配置（摘要 / 标签 / slug / 封面）
CREATE TABLE IF NOT EXISTS ai_post_generators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  prompt TEXT NOT NULL,
  provider_mode TEXT NOT NULL DEFAULT 'workers_ai',
  text_profile_id INTEGER,
  image_profile_id INTEGER,
  workers_model TEXT NOT NULL DEFAULT '',
  temperature REAL NOT NULL DEFAULT 0.7,
  max_tokens INTEGER NOT NULL DEFAULT 2000,
  aspect_ratio TEXT NOT NULL DEFAULT '16:9',
  resolution TEXT NOT NULL DEFAULT '2k',
  is_enabled INTEGER NOT NULL DEFAULT 1,
  is_builtin INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

INSERT OR IGNORE INTO ai_post_generators (
  target_key, label, description, prompt, provider_mode, workers_model,
  temperature, max_tokens, aspect_ratio, resolution, is_enabled, is_builtin
) VALUES
  (
    'summary',
    '摘要生成',
    '为文章生成 160 字以内摘要',
    '你是专业中文编辑。请基于文章标题、分类、标签和正文，输出一个适合博客列表与 SEO 描述使用的中文摘要。要求信息密度高、准确、自然，不要空话，不要标题党，不要加引号。',
    'workers_ai',
    '@cf/meta/llama-3.1-8b-instruct',
    0.4,
    220,
    '16:9',
    '2k',
    1,
    1
  ),
  (
    'tags',
    '标签生成',
    '提取 3-6 个简洁标签',
    '你是专业中文编辑。请基于文章信息提取最有区分度的中文标签，偏主题词和领域词，避免空泛词、句子和重复词。',
    'workers_ai',
    '@cf/meta/llama-3.1-8b-instruct',
    0.3,
    180,
    '16:9',
    '2k',
    1,
    1
  ),
  (
    'slug',
    'Slug 生成',
    '生成英文 kebab-case slug',
    'You are an expert editor. Generate a short English slug for a blog post. Use only lowercase English words and hyphens. Keep it specific, readable, and concise. Do not include dates unless necessary.',
    'workers_ai',
    '@cf/meta/llama-3.1-8b-instruct',
    0.2,
    80,
    '16:9',
    '2k',
    1,
    1
  ),
  (
    'cover',
    '封面生成',
    '生成博客封面图',
    '你是资深视觉总监。请把文章核心观点转化成一张适合作为中文长文封面的图像：构图明确、主视觉单一、气质现代、有 editorial illustration / concept poster 的完成度。默认不要在图中出现任何可读文字、logo、签名或水印。',
    'workers_ai',
    '@cf/black-forest-labs/flux-1-schnell',
    0.7,
    2000,
    '16:9',
    '2k',
    1,
    1
  );

-- API Token 表（外部工具认证）
CREATE TABLE IF NOT EXISTS api_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  last_used_at INTEGER,
  is_active INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_token ON api_tokens(token);

-- 登录限速表
CREATE TABLE IF NOT EXISTS login_attempts (
  ip TEXT NOT NULL,
  attempted_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts(ip, attempted_at);

-- 提示词收藏
CREATE TABLE IF NOT EXISTS prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  prompt TEXT NOT NULL,
  category TEXT,
  tags TEXT,
  source_url TEXT,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_prompts_public_order
  ON prompts (is_hidden, is_pinned DESC, sort_order, updated_at DESC);

-- Hermes / Flomo 知识闭环投影表。只保存来源标识、筛选结论和短摘要，禁止保存 Memo 原文。

CREATE TABLE IF NOT EXISTS agent_sync_runs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK(source = 'flomo'),
  mode TEXT NOT NULL CHECK(mode IN ('hourly', 'nightly', 'reconcile')),
  status TEXT NOT NULL CHECK(status IN ('running', 'succeeded', 'blocked', 'failed')),
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  discovered_count INTEGER NOT NULL DEFAULT 0,
  selected_count INTEGER NOT NULL DEFAULT 0,
  artifact_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT CHECK(error_message IS NULL OR length(error_message) <= 500),
  snapshot_json TEXT,
  started_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  finished_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_agent_sync_runs_status_time
  ON agent_sync_runs(status, started_at DESC);

CREATE TABLE IF NOT EXISTS agent_source_items (
  source_id TEXT PRIMARY KEY,
  source_updated_at TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  decision TEXT NOT NULL CHECK(decision IN ('ignored', 'candidate', 'processed', 'blocked')),
  domain TEXT NOT NULL CHECK(domain IN ('work', 'investing', 'knowledge', 'content')),
  decision_reason TEXT NOT NULL CHECK(length(decision_reason) <= 300),
  first_seen_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  last_seen_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  processed_at INTEGER,
  last_run_id TEXT NOT NULL,
  FOREIGN KEY(last_run_id) REFERENCES agent_sync_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_agent_source_items_updated
  ON agent_source_items(source_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_source_items_decision
  ON agent_source_items(decision, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS knowledge_artifacts (
  artifact_key TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('knowledge', 'topic', 'draft', 'published')),
  domain TEXT NOT NULL CHECK(domain IN ('work', 'investing', 'knowledge', 'content')),
  stage TEXT NOT NULL,
  title TEXT NOT NULL CHECK(length(title) <= 200),
  summary TEXT NOT NULL CHECK(length(summary) <= 500),
  source_ids_json TEXT NOT NULL,
  target_path TEXT,
  public_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived', 'blocked')),
  first_seen_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  last_run_id TEXT NOT NULL,
  FOREIGN KEY(last_run_id) REFERENCES agent_sync_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_artifacts_type_status
  ON knowledge_artifacts(type, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_artifacts_domain
  ON knowledge_artifacts(domain, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_artifacts_last_run
  ON knowledge_artifacts(last_run_id);

-- 插入默认分类
INSERT OR IGNORE INTO categories (name, slug) VALUES
  ('未分类', 'uncategorized'),
  ('AI工具', 'ai-tools'),
  ('AI', 'ai');
