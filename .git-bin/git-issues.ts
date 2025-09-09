#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

/**
 * Inline-issue collector (simplified)
 * Usage:
 *   ./git-issues.ts [--path PATH] [--out FILE]
 * Defaults: path='.', out='.git-bin/.issues'
 *
 * Rules:
 * - Only tags: TODO, BUG
 * - Priority marker: optional single '!' before colon (e.g., TODO!:)
 */

// Minimal CLI arg parser (avoid external deps)
type Cli = { path?: string; out?: string; _: string[] };
const parseCli = (args: string[]): Cli => {
  const out: Cli = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--path" || a === "-p") { out.path = args[++i]; continue; }
    if (a === "--out" || a === "-o") { out.out = args[++i]; continue; }
    out._.push(a);
  }
  return out;
};

/* ---------- config ---------- */
type Config = {
  ignore: string[];
  contextLines: number;
  maxAgeDays?: number;
};

const defaultConfig: Config = {
  ignore: ["vendor/", "node_modules/", "dist/", ".git/", "*.min.js"],
  contextLines: 0,
};

async function loadConfig(): Promise<Config> {
  try {
    const text = await Deno.readTextFile(".gitodos");
    const config = { ...defaultConfig };
    
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      
      const [k, ...valueParts] = trimmed.split("=");
      const key = (k ?? "");
      const value = valueParts.join("=").trim();
      
      switch (key.trim()) {
        case "ignore":
          config.ignore = value.split(",").map(s => s.trim());
          break;
        case "context_lines":
          config.contextLines = parseInt(value) || 0;
          break;
        case "max_age_days":
          config.maxAgeDays = parseInt(value) || undefined;
          break;
      }
    }
    
    return config;
  } catch {
    return defaultConfig;
  }
}

/* ---------- pure helpers ---------- */
const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");

type Priority = "high" | "normal";
type Issue = { 
  file: string; 
  ln: number; 
  tag: string; 
  msg: string;
  priority: Priority;
  owner?: string;
  date?: string;
  category?: string;
  id?: string;
};

// Basic char helpers
const isWord = (c: string) => {
  const code = c.charCodeAt(0);
  return (code >= 48 && code <= 57) // 0-9
    || (code >= 65 && code <= 90)   // A-Z
    || (code >= 97 && code <= 122)  // a-z
    || c === "_";
};

const skipWs = (s: string, i: number) => {
  while (i < s.length && (s[i] === " " || s[i] === "\t")) i++;
  return i;
};

const startsWithAt = (s: string, i: number, prefix: string) =>
  s.slice(i, i + prefix.length).toLowerCase() === prefix.toLowerCase();

type Meta = { cleanMsg: string; owner?: string; date?: string; category?: string; id?: string };

const extractMetadata = (msg: string): Meta => {
  let i = 0;
  const n = msg.length;
  let owner: string | undefined;
  let date: string | undefined;
  let category: string | undefined;
  let id: string | undefined;

  // Owner: @username[:]
  if (i < n && msg[i] === "@") {
    i++;
    const start = i;
    while (i < n) {
      const ch = msg[i]!;
      const code = ch.charCodeAt(0);
      const ok = (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || ch === "_" || ch === "-";
      if (!ok) break;
      i++;
    }
    if (i > start) {
      owner = msg.slice(start, i);
      if (i < n && msg[i] === ":") i++;
      i = skipWs(msg, i);
    } else {
      i = 0; // reset if not a valid username
    }
  }

  // Helper to read bracket token: [ ... ]
  const readBracket = (): string | undefined => {
    if (i < n && msg[i] === "[") {
      const close = msg.indexOf("]", i + 1);
      if (close > i) {
        const content = msg.slice(i + 1, close);
        i = close + 1;
        if (i < n && msg[i] === ":") i++;
        i = skipWs(msg, i);
        return content;
      }
    }
    return undefined;
  };

  // Date or category from first bracket
  const firstBracket = readBracket();
  if (firstBracket !== undefined) {
    const hasDigit = [...firstBracket].some((c) => c >= "0" && c <= "9") || firstBracket.includes("-");
    if (hasDigit) date = firstBracket; else category = firstBracket;
  }

  // Optional ID: (#123) or (ABC-123) or [#123]
  const readParenOrBracketId = (): string | undefined => {
    if (i < n && (msg[i] === "(" || msg[i] === "[")) {
      const open = msg[i];
      const closeCh = open === "(" ? ")" : "]";
      const close = msg.indexOf(closeCh, i + 1);
      if (close > i) {
        const content = msg.slice(i + 1, close);
        // validate simple patterns
        let valid = false;
        if (content.startsWith("#")) {
          valid = content.length > 1 && [...content.slice(1)].every((c) => c >= "0" && c <= "9");
        } else {
          const dash = content.indexOf("-");
          if (dash > 0) {
            const left = content.slice(0, dash);
            const right = content.slice(dash + 1);
            const leftOk = left.length > 0 && [...left].every((c) => c >= "A" && c <= "Z");
            const rightOk = right.length > 0 && [...right].every((c) => c >= "0" && c <= "9");
            valid = leftOk && rightOk;
          }
        }
        if (valid) {
          i = close + 1;
          if (i < n && msg[i] === ":") i++;
          i = skipWs(msg, i);
          return content;
        }
      }
    }
    return undefined;
  };

  const maybeId = readParenOrBracketId();
  if (maybeId) id = maybeId;

  const cleanMsg = msg.slice(i).trim();
  return { cleanMsg, owner, date, category, id };
};

const parseLine = (line: string, file: string, ln: number, tags: readonly string[]): Issue | null => {
  const lower = line.toLowerCase();
  const tagsLower = tags.map((t) => t.toLowerCase());

  for (let i = 0; i < lower.length; i++) {
    // left boundary must not be a word char
    if (i > 0 && isWord(line[i - 1]!)) continue;
    for (let ti = 0; ti < tagsLower.length; ti++) {
      const tLower = tagsLower[ti]!;
      const tLen = tLower.length;
      if (lower.slice(i, i + tLen) !== tLower) continue;
      const j0 = i + tLen; // position after tag
      // Determine optional priority marker
      let j = j0;
      let marker = "";
      if (j < line.length && line[j] === "!") { marker = "!"; j += 1; }
      // Require colon immediately after tag/marker
      if (j >= line.length || line[j] !== ":") continue;
      j += 1;
      // Skip spaces after colon
      j = skipWs(line, j);
      const rawMsg = line.slice(j).trim();

      // Determine priority from marker
      let priority: Priority = "normal";
      if (marker === "!") priority = "high";

      const { cleanMsg, owner, date, category, id } = extractMetadata(rawMsg);
      const tag = tags[ti]!.toUpperCase();
      return {
        file,
        ln,
        tag,
        msg: cleanMsg,
        priority,
        ...(owner && { owner }),
        ...(date && { date }),
        ...(category && { category }),
        ...(id && { id }),
      };
    }
  }
  return null;
};

/* ---------- git + grep ---------- */
function shouldIgnore(file: string, ignorePatterns: string[]): boolean {
  for (const pattern of ignorePatterns) {
    // Simple pattern matching
    if (pattern.endsWith("/")) {
      // Directory pattern
      if (file.startsWith(pattern)) return true;
    } else if (pattern.startsWith("*.")) {
      // Extension pattern
      const ext = pattern.slice(1);
      if (file.endsWith(ext)) return true;
    } else {
      // Exact match or contains
      if (file === pattern || file.includes(pattern)) return true;
    }
  }
  return false;
}

async function* grepFiles(root: string, tags: readonly string[], ignorePatterns: string[]) {
  const cmd = [
    "-C",
    root,
    "ls-files",
    "-z",
    "--cached",
    "--others",
    "--exclude-standard",
    "--",
    ".",
  ];
  const proc = new Deno.Command("git", {
    args: cmd,
    stdout: "piped",
  });
  const result = await proc.output();
  if (result.code !== 0) {
    throw new Error(`git ls-files failed with code ${result.code}`);
  }
  const files = new TextDecoder()
    .decode(result.stdout)
    .split("\0")
    .filter(Boolean)
    .filter((f) => !shouldIgnore(f, ignorePatterns));

  for (const file of files) {
    const content = await Deno.readTextFile(`${root}/${file}`);
    for (const [idx, line] of content.split("\n").entries()) {
      const issue = parseLine(line, file, idx + 1, tags);
      if (issue) yield issue;
    }
  }
}

/* ---------- cli ---------- */
const config = await loadConfig();

const cli = parseCli(Deno.args);
const argv = {
  path: cli.path ?? ".",
  out: cli.out ?? ".git-bin/.issues",
};

const tags = ["TODO", "BUG"] as const;

const header = [
  `# Inline-issue snapshot ${now()}`,
  `# Columns:  timestamp  path:line  tag  priority  owner  date  category  id  message`,
  "",
].join("\n");

const issues: Issue[] = [];
for await (const it of grepFiles(argv.path, tags, config.ignore)) issues.push(it);

const ts = now();
const col1w = Math.max("path:line".length, ...issues.map((i) => `${i.file}:${i.ln}`.length));
const col2w = Math.max("tag".length, ...issues.map((i) => i.tag.length));
const col3w = Math.max("priority".length, ...issues.map((i) => i.priority.length));
const col4w = Math.max("owner".length, ...issues.map((i) => (i.owner ?? "-").length));
const col5w = Math.max("date".length, ...issues.map((i) => (i.date ?? "-").length));
const col6w = Math.max("category".length, ...issues.map((i) => (i.category ?? "-").length));
const col7w = Math.max("id".length, ...issues.map((i) => (i.id ?? "-").length));

// Sort by priority first (critical > high > normal > low), then by file/line
const priorityOrder = { high: 0, normal: 1 } as const;
const lines = issues
  .sort((a, b) => {
    const prioCmp = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (prioCmp !== 0) return prioCmp;
    return a.file === b.file ? a.ln - b.ln : a.file.localeCompare(b.file);
  })
  .map((i) => 
    `${ts}  ${`${i.file}:${i.ln}`.padEnd(col1w)}  ${i.tag.padEnd(col2w)}  ${i.priority.padEnd(col3w)}  ${(i.owner ?? "-").padEnd(col4w)}  ${(i.date ?? "-").padEnd(col5w)}  ${(i.category ?? "-").padEnd(col6w)}  ${(i.id ?? "-").padEnd(col7w)}  ${i.msg}`);

const out = header + lines.join("\n") + "\n";
await Deno.writeTextFile(argv.out, out);

// Also emit JSON alongside text output for tooling/CI
try {
  const outPath = String(argv.out);
  const slash = outPath.lastIndexOf("/");
  const dir = slash >= 0 ? outPath.slice(0, slash) : ".";
  const base = slash >= 0 ? outPath.slice(slash + 1) : outPath;
  let jsonName: string;
  if (base === ".issues") jsonName = "issues.json";
  else if (base === ".bugs") jsonName = "bugs.json";
  else if (base.startsWith(".")) jsonName = `${base.slice(1)}.json`;
  else jsonName = `${base}.json`;
  const jsonPath = `${dir}/${jsonName}`;

  const jsonEntries = issues.map((i) => ({
    ts,
    file: i.file,
    line: i.ln,
    tag: i.tag,
    message: i.msg,
    priority: i.priority,
    ...(i.owner ? { owner: i.owner } : {}),
    ...(i.date ? { date: i.date } : {}),
    ...(i.category ? { category: i.category } : {}),
    ...(i.id ? { id: i.id } : {}),
  }));

  await Deno.writeTextFile(jsonPath, JSON.stringify(jsonEntries, null, 2) + "\n");
  console.error(`Found ${issues.length} issues → ${argv.out} (+ ${jsonPath})`);
} catch (e) {
  console.error("Failed to write JSON output:", e instanceof Error ? e.message : String(e));
  console.error(`Found ${issues.length} issues → ${argv.out}`);
}
