#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

/**
 * Inline-issue collector
 * Usage:
 *   ./git-issues.ts [--path PATH] [--tag TAG,TAG…] [--out FILE]
 * Defaults: path='.', tag='TODO,BUG,FIXME,XXX,HACK', out='.git-bin/.issues'
 */

import { parseArgs } from "https://deno.land/std@0.208.0/cli/parse_args.ts";

/* ---------- pure helpers ---------- */
const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");

const buildRegex = (tags: string[]) => new RegExp(`\\b(${tags.join("|")})\\b:\\s*(.+)`, "i");

type Issue = { file: string; ln: number; tag: string; msg: string };

const parseLine = (line: string, file: string, ln: number, tags: string[]): Issue | null => {
  const m = line.match(buildRegex(tags));
  return m ? { file, ln, tag: (m[1] ?? "").toUpperCase(), msg: (m[2] ?? "").trim() } : null;
};

/* ---------- git + grep ---------- */
async function* grepFiles(root: string, tags: string[]) {
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
    .filter((f) => !f.startsWith(".git/") && !f.startsWith(".git-bin/"));

  for (const file of files) {
    const content = await Deno.readTextFile(`${root}/${file}`);
    for (const [idx, line] of content.split("\n").entries()) {
      const issue = parseLine(line, file, idx + 1, tags);
      if (issue) yield issue;
    }
  }
}

/* ---------- cli ---------- */
const argv = parseArgs(Deno.args, {
  string: ["path", "tag", "out"],
  default: {
    path: ".",
    tag: "TODO,BUG,FIXME,XXX,HACK",
    out: ".git-bin/.issues",
  },
  alias: { p: "path", t: "tag", o: "out" },
});

const tags = argv.tag.split(",").map((s) => s.trim());

const header = [
  `# Inline-issue snapshot ${now()}`,
  `# Columns:  timestamp  path:line  tag  message`,
  "",
].join("\n");

const issues: Issue[] = [];
for await (const it of grepFiles(argv.path, tags)) issues.push(it);

const ts = now();
const col1w = Math.max("path:line".length, ...issues.map((i) => `${i.file}:${i.ln}`.length));
const col2w = Math.max("tag".length, ...issues.map((i) => i.tag.length));

const lines = issues
  .sort((a, b) => (a.file === b.file ? a.ln - b.ln : a.file.localeCompare(b.file)))
  .map((i) => `${ts}  ${`${i.file}:${i.ln}`.padEnd(col1w)}  ${i.tag.padEnd(col2w)}  ${i.msg}`);

const out = header + lines.join("\n") + "\n";
await Deno.writeTextFile(argv.out, out);
console.error(`Found ${issues.length} issues → ${argv.out}`);
