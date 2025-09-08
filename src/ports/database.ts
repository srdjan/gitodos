import type { Result } from "../lib/result.ts";

// Database integration port (define capabilities; implement adapters under src/adapters/)
// TODO: Implement adapters for Postgres/SQLite (connection pooling, migrations, retries).
// TODO: Add transaction support with function-scoped unit of work.

export type DatabaseError =
  | { readonly type: "connection_failed"; readonly message: string }
  | { readonly type: "constraint_violation"; readonly constraint: string }
  | { readonly type: "not_found"; readonly entity: string; readonly id?: string };

export interface Database {
  readonly query: <T>(sql: string, params?: readonly unknown[]) => Promise<Result<readonly T[], DatabaseError>>;
  // TODO: Add transactional wrapper: transaction<T>(fn: (db: Database) => Promise<Result<T, DatabaseError>>)
}

