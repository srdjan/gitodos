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

## Conventions (What gets picked up)

A line is collected when it contains a supported tag followed by a colon and some text:

- `// TODO: message here`
- `# BUG: message here`

Only the tags `TODO` and `BUG` are supported. `FIXME` and other tags are intentionally ignored.

### Priority Markers

Use a single `!` before the colon to mark high priority:
- `TODO!:` or `BUG!:` — High priority
- `TODO:` or `BUG:` — Normal priority

### Metadata Extraction (NEW!)

Extract rich metadata from your issues:
- **Owner**: `TODO: @username: message` - Assign to a person
- **Date**: `TODO: [2025-01-15]: message` - Add due dates
- **Category**: `TODO: [auth]: message` - Group by module/feature
- **Issue ID**: `TODO: (#42): message` or `BUG: (REF-123): message` - Link to tickets

Combine multiple metadata: `TODO!!: @alice: [2025-01-10] Deploy hotfix`

### Default Tags

- `TODO, BUG`

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

## HTML Dashboard (Static)

Generate a responsive, zero-dependency HTML page that visualizes all collected issues with advanced
filtering, sorting, and organization.

- Output file: `.git-bin/issues.html`
- **Enhanced Features (NEW!):**
  - **Real-time search** - Filter issues by message or file content
  - **Priority visualization** - Color-coded priority indicators
  - **Statistics dashboard** - Issue counts by type, priority, and status
  - **Group by directory** - Collapsible file groups for better organization
  - **Metadata display** - Shows owner, date, category, and issue IDs
  - **Keyboard shortcuts** - `/` for search, `g` for grouping, `Esc` to clear
  - **Smart sorting** - Sort by priority, file, line, tag, or timestamp
  - **Responsive design** - Mobile-friendly with touch support

Usage:

```
# Build the HTML from .issues and .bugs
deno task issues:web

# Build (if needed) and open (cross-platform)
deno task issues:web:open

# Live mode: rescan and rebuild on any change
deno task issues:watch
```

Notes:

- `issues:web:open` is cross‑platform and will generate the HTML if missing.
- If the page appears empty, run a scan first to generate `.git-bin/.issues` and `.git-bin/.bugs`.

## Tasks (deno.json)

Convenience tasks are provided:

- Full repo scan → `.git-bin/.issues`
  - `deno task issues:scan`
- Only `src/`, only TODO/BUG → `.git-bin/.bugs`
  - `deno task issues:scan:src`
- Generate HTML dashboard → `.git-bin/issues.html`
  - `deno task issues:web`
- Build + open dashboard (cross‑platform)
  - `deno task issues:web:open`
- Install a post‑commit hook to update snapshots + HTML automatically
  - `deno task issues:hook:install`
- Watch and auto‑refresh snapshots + HTML on change
  - `deno task issues:watch`

If you prefer manual invocation:

```
.git-bin/git-issues.ts                # defaults to .git-bin/.issues
.git-bin/git-issues.ts --path src --out .git-bin/.bugs
```

## Git Hook

The hook created by `issues:hook:install` writes a `post-commit` script that regenerates both
snapshots and the HTML dashboard automatically:

```
#!/bin/sh
.git-bin/git-issues.ts --out .git-bin/.issues
.git-bin/git-issues.ts --path src --out .git-bin/.bugs
.git-bin/issues-web.ts
```

Notes:

- The installer also marks the scripts as executable to avoid permission errors.
- You can open the HTML afterwards with `deno task issues:web:open` (macOS) or by opening
  `.git-bin/issues.html` directly.

## Configuration File

Create a `.gitodos` file in your repository root to configure defaults:

```ini
# .gitodos configuration file

# Patterns to ignore (comma-separated)
# Supports: directory/ for directories, *.ext for extensions
ignore=vendor/,node_modules/,dist/,.git/,*.min.js

# Future: Number of context lines around issues
# context_lines=0
```

## Customization

Command-line options:

- Path scope: `--path <dir>` (default: `.`)
- Output file: `--out <file>` (default: `.git-bin/.issues`)

You can add more tasks in `deno.json` for frequently used combinations.

## Tips

- Consider adding `.git-bin/.issues` and `.git-bin/.bugs` to your PRs so reviewers see the current
  snapshot of inline issues.
- The scanner includes untracked (non‑ignored) files so you get immediate feedback while iterating.
- If a line should be ignored, simply remove the colon after the tag (e.g.,
  `// TODO remove this later` will not match).

## Known limitations

- It matches `TAG:` with a colon; lines like `// TODO something` (no colon) are intentionally
  ignored to reduce false positives.
- The per‑line `timestamp` reflects when the snapshot was taken, not when a comment was added.
- Only files listed by `git ls-files --cached --others --exclude-standard` are scanned; ignored
  files (per `.gitignore`) are skipped by design.
- Minimal, non‑regex parser by design: only `TODO:` and `BUG:` are recognized; a single `!` before
  the colon marks high priority (e.g., `TODO!:`). Metadata (`@owner`, `[date|category]`, `(#id)`/`(ABC-123)`) is parsed only at the start of the message if present.

## Recent Enhancements

✅ **Priority** - High (`!`) and Normal
✅ **Metadata extraction** - Owner, dates, categories, issue IDs
✅ **Configuration file** - `.gitodos` for ignore patterns
✅ **Enhanced dashboard** - Search, stats, grouping, keyboard shortcuts
✅ **Smart sorting** - Priority-first ordering
✅ **JSON outputs** - `.git-bin/issues.json` and `.git-bin/bugs.json`
✅ **Watch mode** - `deno task issues:watch` regenerates snapshots + HTML on change
✅ **Cross‑platform open** - `deno task issues:web:open` works on macOS/Linux/Windows
✅ **Minimal parser** - Replaced regex with a tiny hand‑rolled parser

## Roadmap ideas

- Context lines - Show code around issues
- Issue age tracking - Using git blame
- Thresholds for CI - Fail build if high-priority issues exist
- Export formats - JSON/CSV/Markdown reports
- VSCode integration - Quick navigation to issues
- Duplicate detection - Find similar issues
- Time tracking - Estimate/actual time metadata
