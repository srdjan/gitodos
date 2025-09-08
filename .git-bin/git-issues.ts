#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

/**
 * Inline-issue collector
 * Usage:
 *   ./git-issues.ts [--path PATH] [--tag TAG,TAG…] [--out FILE]
 * Defaults: path='.', tag='TODO,BUG,FIXME,XXX,HACK', out='.git-bin/.issues'
 */

import { parseArgs } from "https://deno.land/std@0.208.0/cli/parse_args.ts";

/* ---------- config ---------- */
type Config = {
  tags: string[];
  ignore: string[];
  contextLines: number;
  maxAgeDays?: number;
  includeResolved: boolean;
};

const defaultConfig: Config = {
  tags: ["TODO", "BUG", "FIXME", "XXX", "HACK", "NOTE", "QUESTION"],
  ignore: ["vendor/", "node_modules/", "dist/", ".git/", "*.min.js"],
  contextLines: 0,
  includeResolved: false,
};

async function loadConfig(): Promise<Config> {
  try {
    const text = await Deno.readTextFile(".gitodos");
    const config = { ...defaultConfig };
    
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      
      const [key, ...valueParts] = trimmed.split("=");
      const value = valueParts.join("=").trim();
      
      switch (key.trim()) {
        case "tags":
          config.tags = value.split(",").map(s => s.trim());
          break;
        case "ignore":
          config.ignore = value.split(",").map(s => s.trim());
          break;
        case "context_lines":
          config.contextLines = parseInt(value) || 0;
          break;
        case "max_age_days":
          config.maxAgeDays = parseInt(value) || undefined;
          break;
        case "include_resolved":
          config.includeResolved = value.toLowerCase() === "true";
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

const buildRegex = (tags: string[]) => new RegExp(`\\b(${tags.join("|")})\\b(!!?|\\?)?:\\s*(.+)`, "i");

type Priority = "critical" | "high" | "normal" | "low";
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

const extractMetadata = (msg: string): { 
  cleanMsg: string; 
  owner?: string; 
  date?: string; 
  category?: string;
  id?: string;
} => {
  let cleanMsg = msg;
  let owner: string | undefined;
  let date: string | undefined;
  let category: string | undefined;
  let id: string | undefined;

  // Extract owner @username
  const ownerMatch = msg.match(/^@(\w+)\s*:?\s*/);
  if (ownerMatch) {
    owner = ownerMatch[1];
    cleanMsg = cleanMsg.slice(ownerMatch[0].length);
  }

  // Extract date [YYYY-MM-DD] or [MMM-DD] or [MMM]
  const dateMatch = cleanMsg.match(/^\[([^\]]+)\]\s*:?\s*/);
  if (dateMatch) {
    date = dateMatch[1];
    cleanMsg = cleanMsg.slice(dateMatch[0].length);
  }

  // Extract category [category] (if not already matched as date)
  if (!date) {
    const catMatch = cleanMsg.match(/^\[([a-zA-Z]+)\]\s*:?\s*/);
    if (catMatch) {
      category = catMatch[1];
      cleanMsg = cleanMsg.slice(catMatch[0].length);
    }
  }

  // Extract ID (#123) or (REF-123)
  const idMatch = cleanMsg.match(/^[(\[]?(#\d+|[A-Z]+-\d+)[)\]]?\s*:?\s*/);
  if (idMatch) {
    id = idMatch[1];
    cleanMsg = cleanMsg.slice(idMatch[0].length);
  }

  return { cleanMsg: cleanMsg.trim(), owner, date, category, id };
};

const parseLine = (line: string, file: string, ln: number, tags: string[]): Issue | null => {
  const m = line.match(buildRegex(tags));
  if (!m) return null;

  const tag = (m[1] ?? "").toUpperCase();
  const priorityMarker = m[2] ?? "";
  const rawMsg = (m[3] ?? "").trim();

  // Determine priority based on marker
  let priority: Priority = "normal";
  if (priorityMarker === "!!") priority = "critical";
  else if (priorityMarker === "!") priority = "high";
  else if (priorityMarker === "?") priority = "low";

  // Extract metadata from message
  const { cleanMsg, owner, date, category, id } = extractMetadata(rawMsg);

  return { 
    file, 
    ln, 
    tag, 
    msg: cleanMsg,
    priority,
    ...(owner && { owner }),
    ...(date && { date }),
    ...(category && { category }),
    ...(id && { id })
  };
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

async function* grepFiles(root: string, tags: string[], ignorePatterns: string[]) {
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

const argv = parseArgs(Deno.args, {
  string: ["path", "tag", "out"],
  boolean: ["include-resolved"],
  default: {
    path: ".",
    tag: config.tags.join(","),
    out: ".git-bin/.issues",
    "include-resolved": config.includeResolved,
  },
  alias: { p: "path", t: "tag", o: "out", r: "include-resolved" },
});

const tags = argv.tag.split(",").map((s) => s.trim());
// Add resolved tags if requested
if (argv["include-resolved"]) {
  if (!tags.includes("DONE")) tags.push("DONE");
  if (!tags.includes("RESOLVED")) tags.push("RESOLVED");
}

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
const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
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
console.error(`Found ${issues.length} issues → ${argv.out}`);
