# Inline Issue & Bug Tracker (.git-bin/git-issues.ts)

This repository includes a tiny, dependency‑free scanner that collects inline code issues (e.g.,
TODO/BUG) and writes a snapshot into files under `.git-bin/`.

- Default scan: whole repo → `.git-bin/.issues`
- Subset scan: `src/` only (TODO/BUG) → `.git-bin/.bugs`
- Optional Git hook: automatically refresh after every commit

The scanner is fast, portable, and works across any language as long as comments contain
recognizable tags (e.g., `// TODO: …`, `# BUG: …`).

## Requirements

- Git available on PATH
- Deno (1.41+ recommended)

## Conventions

- Tags: only `TODO` and `BUG`.
- Priority: tight `!` after the tag means high (e.g., `TODO!:` / `BUG!:`). A single space is
  allowed before the colon (e.g., `BUG! : message`).
- Colon: immediate or one space before it (e.g., `TODO:` or `TODO :`).
- Comments scanned (configurable): `// …`, `/* … */`, `# …`, `<!-- … -->`.
- Markdown: scanned with a tiny heuristic — fenced code is ignored and inline backticks are
  stripped before matching.

## Outputs

Each generated file contains a header with the snapshot time and aligned columns per line:

- `timestamp` — when the snapshot was generated
- `path:line` — file path relative to repo + line number
- `tag` — the matched tag
- `priority` — priority level (high/normal)
- `owner` — assigned person (if specified)
- `date` — due date or date marker (if specified)
- `category` — category/module (if specified)
- `id` — issue/ticket ID (if specified)
- `message` — the textual description

Example excerpt:

```
# Inline-issue snapshot 2025-09-08 19:47:06
# Columns:  timestamp  path:line  tag  priority  owner  date  category  id  message
2025-09-08 19:47:06  test.md:22  TODO  high      alice  2025-01-10  -  -  Deploy hotfix for payment processing
2025-09-08 19:47:06  api.ts:14   BUG   high      -      -           api  #99  Rate limiting not working correctly
```

JSON outputs are also generated alongside the text snapshots for tooling/CI:

- `.git-bin/issues.json` and `.git-bin/bugs.json` — array of entries: `{ ts, file, line, tag, message, priority, owner?, date?, category?, id? }`.

## Dashboards

- Active: `.git-bin/issues.html` — search, tag filters, sort (priority/file/line/tag/time), group by
  directory, keyboard shortcuts (`/`, `g`, `Esc`).
- History: `.git-bin/history.html` — journal-backed view with search, type/status filters,
  high-only toggle, and sort (created/completed/priority/type).

Quick usage:

```
deno task issues:scan        # write .issues
deno task issues:scan:src    # write .bugs
deno task issues:web         # build issues.html
deno task issues:web:open    # open issues.html (cross‑platform)
deno task issues:watch       # live scan + rebuild
deno task issues:sync        # sync snapshots to SQLite journal (todos.db)
deno task issues:history     # build history.html
deno task issues:history:open
```

## Tasks (deno.json)

- `issues:scan`, `issues:scan:src`, `issues:web`, `issues:web:open`, `issues:watch`
- `issues:sync`, `issues:history`, `issues:history:open`
- `issues:hook:install` — installs a post‑commit hook to refresh everything

## Git Hook

The hook created by `issues:hook:install` writes a `post-commit` script that regenerates both
snapshots and the HTML dashboard automatically:

```
#!/bin/sh
.git-bin/git-issues.ts --out .git-bin/.issues
.git-bin/git-issues.ts --path src --out .git-bin/.bugs
.git-bin/issues-web.ts
deno run -A .git-bin/issues-sync.ts
deno run -A .git-bin/history-web.ts
```

Notes:

- The installer also marks the scripts as executable to avoid permission errors.
- You can open the HTML afterwards with `deno task issues:web:open` (macOS) or by opening
  `.git-bin/issues.html` directly.

## .gitodos (config)

```ini
# Patterns to ignore (comma-separated)
ignore=vendor/,node_modules/,dist/,.git/,*.min.js

# Comment styles to scan (comma-separated):
# slash (//), block (/* */), hash (#), html (<!-- -->)
comments=slash,block,hash,html
```

## Customization

Command-line options:

- Path scope: `--path <dir>` (default: `.`)
- Output file: `--out <file>` (default: `.git-bin/.issues`)

You can add more tasks in `deno.json` for frequently used combinations.

## Tips

- Keep comments short and actionable; one TODO/BUG per line is ideal.
- Remove the colon if you want a line ignored: `// TODO later` (no match).
- Use the history page to track completion trends.

## Known limitations

- It matches `TAG:` with a colon; lines like `// TODO something` (no colon) are intentionally
  ignored to reduce false positives.
- The per‑line `timestamp` reflects when the snapshot was taken, not when a comment was added.
- Only files listed by `git ls-files --cached --others --exclude-standard` are scanned; ignored
  files (per `.gitignore`) are skipped by design.
- Minimal parser: only `TODO:` and `BUG:`. A tight `!` after the tag marks high (e.g., `TODO!:` / `BUG!:`). Colon may have one space before it. Metadata (`@owner`, `[date|category]`, `(#id)`/`(ABC-123)`) is parsed only at the start of the message if present.

## Recent Enhancements

✅ **Tight priority marker** — `TODO!:` / `BUG!:` (no space before `!`)
✅ **Colon flexibility** — allow one space before the colon (`TODO :`)
✅ **Comment toggles** — `.gitodos` controls `//`, `/* */`, `#`, `<!-- -->`
✅ **Markdown heuristic** — ignore fenced code; strip inline backticks
✅ **JSON snapshots** — `.git-bin/issues.json`, `.git-bin/bugs.json`
✅ **Journal + history** — SQLite sync and `history.html`
✅ **Dashboards** — search/filters/sort; group-by for active view
✅ **Watch + open** — live rebuild, cross‑platform opener
✅ **Minimal, non‑regex parser** — small, predictable scanner

## Roadmap ideas

- Context lines - Show code around issues
- Issue age tracking - Using git blame
- Thresholds for CI - Fail build if high-priority issues exist
- Export formats - JSON/CSV/Markdown reports
- VSCode integration - Quick navigation to issues
- Duplicate detection - Find similar issues
- Time tracking - Estimate/actual time metadata
