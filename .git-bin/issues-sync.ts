#!/usr/bin/env -S deno run -A

// Synchronize current scan results into the SQLite journal (todos.db)
// 1) Ensure JSON snapshots exist (runs scanner if needed)
// 2) Upsert current items as 'active'
// 3) Mark previously-active items no longer present as 'completed'

import { TodoDB, type ScanItem } from "./todo-db.ts";

const ROOT = ".git-bin";
const ISSUES_JSON = `${ROOT}/issues.json`;
const BUGS_JSON = `${ROOT}/bugs.json`;

async function ensureSnapshots() {
  const have = async (p: string) => {
    try { await Deno.stat(p); return true; } catch { return false; }
  };
  const needIssues = !(await have(ISSUES_JSON));
  const needBugs = !(await have(BUGS_JSON));
  if (needIssues || needBugs) {
    const run = async (args: string[]) => {
      const p = new Deno.Command("deno", { args, stdout: "null", stderr: "inherit" });
      await p.output();
    };
    await run(["run", "--allow-read", "--allow-write", "--allow-run", ".git-bin/git-issues.ts", "--out", ".git-bin/.issues"]);
    await run(["run", "--allow-read", "--allow-write", "--allow-run", ".git-bin/git-issues.ts", "--path", "src", "--out", ".git-bin/.bugs"]);
    await run(["run", "--allow-read", "--allow-write", ".git-bin/issues-web.ts"]);
  }
}

async function loadJson(path: string): Promise<any[]> {
  try {
    const txt = await Deno.readTextFile(path);
    return JSON.parse(txt);
  } catch {
    return [];
  }
}

function toScanItem(row: any): ScanItem | null {
  const tag = String(row.tag ?? "").toUpperCase();
  if (tag !== "TODO" && tag !== "BUG") return null;
  const message = String(row.message ?? "");
  const file = String(row.file ?? "");
  const line = Number(row.line ?? 0);
  const priority = row.priority === "high" ? "high" : "normal";
  return { tag, message, file, line, priority } as ScanItem;
}

async function main() {
  await ensureSnapshots();
  const [issues, bugs] = await Promise.all([loadJson(ISSUES_JSON), loadJson(BUGS_JSON)]);
  const all = [...issues, ...bugs].map(toScanItem).filter((x): x is ScanItem => Boolean(x));

  const db = new TodoDB();
  try {
    for (const it of all) db.upsertFromScan(it);
    const keys = all.map((it) => `${it.tag}|${it.file}|${it.message}`);
    db.completeMissingActive(keys);
  } finally {
    db.close();
  }
  console.log(`Synced ${all.length} items to todos.db`);
}

if (import.meta.main) {
  await main();
}

