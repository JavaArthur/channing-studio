# chen-notes routing and Git gates

Repository: `/Users/channing/file/chen-notes`

## Mandatory preflight

Run in order:

```bash
cd /Users/channing/file/chen-notes
git status --short
git pull --ff-only
```

If status is dirty, fail with `CHEN_NOTES_DIRTY`. If pull fails, fail with `CHEN_NOTES_PULL_FAILED`. Do not reset, rebase, clean, delete, stash, or overwrite.

After a successful pull, read in this exact order:

1. `INDEX.ai.md`
2. `AGENTS.md`
3. `README.md`
4. `USER.md`
5. target directory `README.md`
6. target file and relevant historical notes

If a target directory has no `README.md`, use its nearest parent `README.md` and mention the missing rule file in the run summary.

## Routing

- New or unclear external input: `00-Inbox/`. Do not use Inbox for routine low-value ignored memos.
- Work and active projects: `03-工作/`; also re-read relevant `05-知识库/工具经验/` and `05-知识库/提示词方法/` material.
- Investing: `04-投资/`; re-read `交易系统.md`, `心法.md`, and recent daily reviews. Do not modify the first two without explicit authorization.
- Reusable methods and knowledge: `05-知识库/`.
- Content pipeline: `06-内容创作/01-选题池/`, `02-写作中/`, `03-待发布/`, `04-已发布/`.
- System rules and all files under `99-系统/` are protected and require explicit authorization.
- `98-历史资料/` is read-only by default.

Prefer updating an existing file. New file names must be one of `YYYY-MM-DD.md`, `YYYY-MM-DD-来源-主题.md`, `主题名.md`, or `YYYY-MM-DD-对象.md`. Formal notes use the repository frontmatter and at most five tags.

## Completion gate

After writing:

```bash
git status --short
git add <only-files-changed-by-this-run>
git commit -m "auto: <short description>"
git push
```

Only after push succeeds may an artifact be reported as synchronized. A push failure maps to `CHEN_NOTES_PUSH_FAILED`; preserve local changes and report the blocker.
