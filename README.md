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

A line is collected when it contains a tag followed by a colon and some text:

- `// TODO: message here`
- `# BUG: message here`
- `/* FIXME: message here */`

### Priority Markers (NEW!)

Add priority markers to your issues:
- `TODO!!:` - Critical priority (shown in red)
- `TODO!:` - High priority (shown in orange)
- `TODO:` - Normal priority (default)
- `TODO?:` - Low priority (shown in gray)

### Metadata Extraction (NEW!)

Extract rich metadata from your issues:
- **Owner**: `TODO: @username: message` - Assign to a person
- **Date**: `TODO: [2025-01-15]: message` - Add due dates
- **Category**: `TODO: [auth]: message` - Group by module/feature
- **Issue ID**: `TODO: (#42): message` or `BUG: (REF-123): message` - Link to tickets

Combine multiple metadata: `TODO!!: @alice: [2025-01-10] Deploy hotfix`

### Default Tags

- `TODO, BUG, FIXME, XXX, HACK, NOTE, QUESTION`
- `DONE, RESOLVED` (when using `--include-resolved` flag)

You can customize tags via `--tag` (comma‑separated) or `.gitodos` config file:

```
.git-bin/git-issues.ts --tag TODO,BUG
```

## Outputs

Each generated file contains a header with the snapshot time and aligned columns per line:

- `timestamp` — when the snapshot was generated
- `path:line` — file path relative to repo + line number
- `tag` — the matched tag
- `priority` — priority level (critical/high/normal/low)
- `owner` — assigned person (if specified)
- `date` — due date or date marker (if specified)
- `category` — category/module (if specified)
- `id` — issue/ticket ID (if specified)
- `message` — the textual description

Example excerpt:

```
# Inline-issue snapshot 2025-09-08 19:47:06
# Columns:  timestamp  path:line  tag  priority  owner  date  category  id  message
2025-09-08 19:47:06  test.md:22  TODO  critical  alice  2025-01-10  -  -  Deploy hotfix for payment processing
2025-09-08 19:47:06  api.ts:14   BUG   high      -      -           api  #99  Rate limiting not working correctly
```

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

# macOS convenience: build and open
deno task issues:web:open
```

Notes:

- If you’re on Linux or Windows, open the file manually (or use `xdg-open .git-bin/issues.html` on
  Linux, `start .git-bin\issues.html` on Windows).
- If the page appears empty, run the scan tasks first to generate `.git-bin/.issues` and
  `.git-bin/.bugs`.

## Tasks (deno.json)

Convenience tasks are provided:

- Full repo scan → `.git-bin/.issues`
  - `deno task issues:scan`
- Only `src/`, only TODO/BUG → `.git-bin/.bugs`
  - `deno task issues:scan:src`
- Generate HTML dashboard → `.git-bin/issues.html`
  - `deno task issues:web`
- Build + open dashboard (macOS) → opens in default browser
  - `deno task issues:web:open`
- Install a post‑commit hook to update snapshots + HTML automatically
  - `deno task issues:hook:install`

If you prefer manual invocation:

```
.git-bin/git-issues.ts                # defaults to .git-bin/.issues
.git-bin/git-issues.ts --path src \
  --tag TODO,BUG --out .git-bin/.bugs
```

## Git Hook

The hook created by `issues:hook:install` writes a `post-commit` script that regenerates both
snapshots and the HTML dashboard automatically:

```
#!/bin/sh
.git-bin/git-issues.ts --out .git-bin/.issues
.git-bin/git-issues.ts --path src --tag TODO,BUG --out .git-bin/.bugs
.git-bin/issues-web.ts
```

Notes:

- The installer also marks the scripts as executable to avoid permission errors.
- You can open the HTML afterwards with `deno task issues:web:open` (macOS) or by opening
  `.git-bin/issues.html` directly.

## Configuration File (NEW!)

Create a `.gitodos` file in your repository root to configure defaults:

```ini
# .gitodos configuration file

# Tags to scan for (comma-separated)
tags=TODO,BUG,FIXME,XXX,HACK,NOTE,QUESTION

# Patterns to ignore (comma-separated)
# Supports: directory/ for directories, *.ext for extensions
ignore=vendor/,node_modules/,dist/,.git/,*.min.js

# Include resolved issues (DONE, RESOLVED) in scans
include_resolved=false

# Future: Number of context lines around issues
# context_lines=1
```

## Customization

Command-line options override configuration file settings:

- Path scope: `--path <dir>` (default: `.`)
- Tags: `--tag TAG1,TAG2` (overrides config)
- Output file: `--out <file>` (default: `.git-bin/.issues`)
- Include resolved: `--include-resolved` (includes DONE/RESOLVED tags)

You can add more tasks in `deno.json` if you frequently use custom combinations.

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

## Recent Enhancements

✅ **Priority levels** - Critical/High/Normal/Low with visual indicators
✅ **Metadata extraction** - Owner, dates, categories, issue IDs
✅ **Configuration file** - `.gitodos` for project settings
✅ **Enhanced dashboard** - Search, stats, grouping, keyboard shortcuts
✅ **Smart sorting** - Priority-first ordering

## Roadmap ideas

- Context lines - Show code around issues
- Issue age tracking - Using git blame
- Thresholds for CI - Fail build if critical issues exist
- Export formats - JSON/CSV/Markdown reports
- VSCode integration - Quick navigation to issues
- Duplicate detection - Find similar issues
- Time tracking - Estimate/actual time metadata
