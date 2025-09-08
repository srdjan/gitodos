# Inline Issue & Bug Tracker (.git-bin/git-issues.ts)

This repository includes a tiny, dependency‑free scanner that collects inline code issues (e.g., TODO/BUG) and writes a snapshot into files under `.git-bin/`.

- Default scan: whole repo → `.git-bin/.issues`
- Subset scan: `src/` only (TODO/BUG) → `.git-bin/.bugs`
- Optional Git hook: automatically refresh after every commit

The scanner is fast, portable, and works across any language as long as comments contain recognizable tags (e.g., `// TODO: …`, `# BUG: …`).

## Requirements

- Git available on PATH
- Deno (1.41+ recommended)

## Conventions (What gets picked up)

A line is collected when it contains a tag followed by a colon and some text:

- `// TODO: message here`
- `# BUG: message here`
- `/* FIXME: message here */`

Tags are case‑insensitive. By default, the following tags are scanned:

- `TODO, BUG, FIXME, XXX, HACK`

You can customize tags via `--tag` (comma‑separated):

```
.git-bin/git-issues.ts --tag TODO,BUG
```

## Outputs

Each generated file contains a header with the snapshot time and aligned columns per line:

- `timestamp` — when the snapshot was generated
- `path:line` — file path relative to repo + line number
- `tag` — the matched tag
- `message` — the textual description captured after `TAG:`

Example excerpt:

```
# Inline-issue snapshot 2025-09-08 18:56:41
# Columns:  timestamp  path:line  tag  message
2025-09-08 18:56:41  src/http/router.ts:24  TODO  Generate OpenAPI (and docs site) from route schemas and metadata.
```

## Tasks (deno.json)

Convenience tasks are provided:

- Full repo scan → `.git-bin/.issues`
  - `deno task issues:scan`
- Only `src/`, only TODO/BUG → `.git-bin/.bugs`
  - `deno task issues:scan:src`
- Install a post‑commit hook to update the snapshot automatically
  - `deno task issues:hook:install`

If you prefer manual invocation:

```
.git-bin/git-issues.ts                # defaults to .git-bin/.issues
.git-bin/git-issues.ts --path src \
  --tag TODO,BUG --out .git-bin/.bugs
```

## Git Hook

The hook created by `issues:hook:install` writes a simple `post-commit` script that executes the scanner. The scanner has a Deno shebang, so it can be executed directly.

If you want the hook to generate both files on every commit, you can adapt the hook to:

```
#!/bin/sh
exec .git-bin/git-issues.ts --out .git-bin/.issues
# Also generate subset if desired:
# .git-bin/git-issues.ts --path src --tag TODO,BUG --out .git-bin/.bugs
```

## Customization

- Path scope: `--path <dir>` (default: `.`)
- Tags: `--tag TAG1,TAG2` (default: `TODO,BUG,FIXME,XXX,HACK`)
- Output file: `--out <file>` (default: `.git-bin/.issues`)

You can add more tasks in `deno.json` if you frequently use custom combinations.

## Tips

- Consider adding `.git-bin/.issues` and `.git-bin/.bugs` to your PRs so reviewers see the current snapshot of inline issues.
- The scanner includes untracked (non‑ignored) files so you get immediate feedback while iterating.
- If a line should be ignored, simply remove the colon after the tag (e.g., `// TODO remove this later` will not match).

## Known limitations

- It matches `TAG:` with a colon; lines like `// TODO something` (no colon) are intentionally ignored to reduce false positives.
- The per‑line `timestamp` reflects when the snapshot was taken, not when a comment was added.
- Only files listed by `git ls-files --cached --others --exclude-standard` are scanned; ignored files (per `.gitignore`) are skipped by design.

## Roadmap ideas

- Thresholds for CI (e.g., fail build if new BUGs are added)
- Output formats (JSON/CSV) for dashboards
- Group by directory/module with summaries
- Linkification for GitHub/Gitea viewers

