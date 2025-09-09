// deno-lint-ignore-file no-explicit-any
// Simple SQLite-backed journal for TODO/BUG items
// Stores a durable history while remaining minimal and dependency-light.

import { DB } from "https://deno.land/x/sqlite/mod.ts";

export type TodoType = "TODO" | "BUG";
export type TodoStatus = "active" | "completed" | "cancelled";

export interface TodoRow {
  id: number;
  type: TodoType;
  title: string;
  description: string | null;
  status: TodoStatus;
  created_at: string; // ISO-ish string from SQLite
  completed_at: string | null;
  priority: number; // 1..5 (default 3)
  tags: string | null; // comma-separated or JSON
  source_key: string; // unique fingerprint to upsert by
}

export type ScanItem = {
  tag: TodoType;
  message: string;
  file: string;
  line: number;
  priority: "high" | "normal";
};

export class TodoDB {
  private db: DB;

  constructor(path = ".git-bin/todos.db") {
    this.db = new DB(path);
    this.initialize();
  }

  private initialize() {
    this.db.execute(`
      CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT CHECK(type IN ('TODO','BUG')) NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT CHECK(status IN ('active','completed','cancelled')) DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        priority INTEGER DEFAULT 3 CHECK(priority BETWEEN 1 AND 5),
        tags TEXT,
        source_key TEXT UNIQUE NOT NULL
      );
    `);

    this.db.execute(`CREATE INDEX IF NOT EXISTS idx_status ON todos(status);`);
    this.db.execute(`CREATE INDEX IF NOT EXISTS idx_type_status ON todos(type, status);`);
    this.db.execute(`CREATE INDEX IF NOT EXISTS idx_completed_at ON todos(completed_at);`);
  }

  // Map high/normal to 5..1 (subjective: high=4, normal=3)
  private toPriorityInt(p: ScanItem["priority"]): number {
    return p === "high" ? 4 : 3;
  }

  private fingerprint(s: ScanItem): string {
    // Stable key that survives line movement: tag + file + message
    // We intentionally exclude line to avoid churn when code shifts.
    return `${s.tag}|${s.file}|${s.message}`;
  }

  upsertFromScan(item: ScanItem) {
    const sourceKey = this.fingerprint(item);
    const title = item.message;
    const description = `${item.file}:${item.line}`;
    const priority = this.toPriorityInt(item.priority);

    // Upsert by source_key; if previously completed/cancelled, reactivate
    if (!item.tag || (item.tag !== "TODO" && item.tag !== "BUG")) {
      console.error("Skipping invalid tag", JSON.stringify({ item }));
      return;
    }
    console.error("UPSERT", { tag: item.tag, title, description, priority, sourceKey });
    this.db.query(
      `INSERT INTO todos (type, title, description, status, priority, source_key)
       VALUES (?, ?, ?, 'active', ?, ?)
       ON CONFLICT(source_key) DO UPDATE SET
         title=excluded.title,
         description=excluded.description,
         priority=excluded.priority,
         status='active',
         completed_at=CASE WHEN todos.status!='active' THEN NULL ELSE todos.completed_at END;`,
      [item.tag, title, description, priority, sourceKey],
    );
  }

  completeMissingActive(currentSourceKeys: readonly string[]) {
    const placeholders = currentSourceKeys.map(() => "?").join(",");
    const notInClause = currentSourceKeys.length > 0 ? `AND source_key NOT IN (${placeholders})` : "";
    this.db.execute(
      `UPDATE todos
       SET status='completed', completed_at=CURRENT_TIMESTAMP
       WHERE status='active' ${notInClause};`,
      currentSourceKeys as any,
    );
  }

  getActive(limit = 200): TodoRow[] {
    const rs = this.db.query(
      "SELECT id,type,title,description,status,created_at,completed_at,priority,tags,source_key FROM todos WHERE status='active' ORDER BY priority DESC, created_at DESC LIMIT ?",
      [limit],
    );
    return rs.map((r) => this.mapRow(r));
  }

  getAll(limit = 200, offset = 0): TodoRow[] {
    const rs = this.db.query(
      "SELECT id,type,title,description,status,created_at,completed_at,priority,tags,source_key FROM todos ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [limit, offset],
    );
    return rs.map((r) => this.mapRow(r));
  }

  getStats() {
    const totalActive = this.scalar(`SELECT COUNT(*) FROM todos WHERE status='active'`);
    const totalCompleted = this.scalar(`SELECT COUNT(*) FROM todos WHERE status='completed'`);
    const completedThisWeek = this.scalar(
      `SELECT COUNT(*) FROM todos WHERE status='completed' AND completed_at >= datetime('now','-7 days')`,
    );
    const bugVsTodo = this.db.query(
      `SELECT type, status, COUNT(*) as count FROM todos GROUP BY type, status`,
    );
    return { totalActive, totalCompleted, completedThisWeek, bugVsTodo };
  }

  private scalar(sql: string): number {
    const row = this.db.query(sql)[0]?.[0];
    return typeof row === "number" ? row : 0;
  }

  private mapRow(r: any[]): TodoRow {
    return {
      id: r[0] as number,
      type: r[1] as TodoType,
      title: r[2] as string,
      description: (r[3] ?? null) as string | null,
      status: r[4] as TodoStatus,
      created_at: r[5] as string,
      completed_at: (r[6] ?? null) as string | null,
      priority: r[7] as number,
      tags: (r[8] ?? null) as string | null,
      source_key: r[9] as string,
    };
  }

  close() {
    this.db.close();
  }
}
