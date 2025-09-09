# Repository Guidelines

## Project Structure & Module Organization
- Source code lives in `src/`.
  - `src/main.ts` — HTTP server entrypoint.
  - `src/http/` — router, middleware, handlers, response helpers.
  - `src/ports/` — interfaces (Clock, Logger, Database).
  - `src/adapters/` — concrete implementations (e.g., `console-logger.ts`).
  - `src/lib/` — small, pure utilities (e.g., `result.ts`).
- Issue tooling lives in `.git-bin/` (`git-issues.ts`, `issues-web.ts`).
- Optional config: `.gitodos` controls scan tags/ignores.

## Build, Test, and Development Commands
- Start server (dev with watch): `deno task server:dev` (serves on `PORT` or 8000).
- Start server (prod-like): `deno task server:start`.
- Run tests: `deno task test`.
- Scan issues: `deno task issues:scan` (repo) or `deno task issues:scan:src` (only `src/`).
- Generate dashboard: `deno task issues:web` (open `.git-bin/issues.html`).
- Install Git hook: `deno task issues:hook:install`.

## Coding Style & Naming Conventions
- TypeScript (Deno) with strict settings; prefer `readonly`, pure functions, and small modules.
- File names: `kebab-case.ts`; tests: `*_test.ts` or `.test.ts` beside sources.
- Format and lint before pushing: `deno fmt && deno lint` (width 100 as in `deno.json`).
- Use type-only imports when importing types (`import type …`).

## Testing Guidelines
- Use Deno’s built-in runner and `@std/assert` (`jsr:@std/assert`).
- Name tests after modules, e.g., `src/http/router_test.ts`.
- Aim for fast, deterministic unit tests; avoid network/file I/O unless essential.

## Commit & Pull Request Guidelines
- Commits: concise, imperative (“add router param parsing”); group related changes.
- Link issues or reference inline tags where relevant (e.g., `BUG`, `TODO`).
- PRs must include: clear description, test notes, screenshots of `.git-bin/issues.html` if UI/data changes, and updated docs/config when applicable.

## Security & Configuration Tips
- Deno permissions: server needs `--allow-net`; dashboard generation uses `--allow-read --allow-write`.
- Don’t commit secrets; configuration comes from environment (e.g., `PORT`).
- Generated files in `.git-bin/` are git-ignored by default.

## Agent-Specific Notes
- Keep changes minimal and localized; do not reformat unrelated files.
- Follow the ports/adapters pattern; avoid side effects in `lib/` and response helpers.
- When adding functionality, include or update tests and relevant `deno task` entries.
