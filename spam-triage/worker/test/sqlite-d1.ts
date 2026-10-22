import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Env } from "../types.ts";

type SqlValue = string | number | bigint | null | Uint8Array;

interface D1Meta {
  changes: number;
  last_row_id: number;
}

interface D1Result<T> {
  success: true;
  results: T[];
  meta: D1Meta;
}

class SqliteStatement {
  private readonly db: DatabaseSync;
  private readonly sql: string;
  private params: SqlValue[];

  constructor(db: DatabaseSync, sql: string, params: SqlValue[] = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }

  bind(...params: SqlValue[]) {
    this.params = params;
    return this;
  }

  async first<T>(): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...this.params) as T | undefined;
    return row ?? null;
  }

  async all<T>(): Promise<D1Result<T>> {
    const results = this.db.prepare(this.sql).all(...this.params) as T[];
    return {
      success: true,
      results,
      meta: { changes: 0, last_row_id: 0 },
    };
  }

  async run(): Promise<D1Result<unknown>> {
    const result = this.db.prepare(this.sql).run(...this.params);
    return {
      success: true,
      results: [],
      meta: {
        changes: Number(result.changes),
        last_row_id: Number(result.lastInsertRowid),
      },
    };
  }

  async execute(): Promise<D1Result<unknown>> {
    if (
      /^\s*(SELECT|WITH)\b/i.test(this.sql) ||
      /\bRETURNING\b/i.test(this.sql)
    ) {
      return this.all<unknown>();
    }
    return this.run();
  }
}

export class SqliteD1Database {
  private readonly db: DatabaseSync;
  private queries = 0;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  get queryCount() {
    return this.queries;
  }

  resetQueryCount() {
    this.queries = 0;
  }

  prepare(sql: string) {
    this.queries += 1;
    return new SqliteStatement(this.db, sql);
  }

  async batch(statements: SqliteStatement[]) {
    this.db.exec("BEGIN");
    try {
      const results: D1Result<unknown>[] = [];
      for (const statement of statements) {
        results.push(await statement.execute());
      }
      this.db.exec("COMMIT");
      return results;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  close() {
    this.db.close();
  }

  raw() {
    return this.db;
  }
}

export function createTestDb(): SqliteD1Database {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");

  const migrationsDir = join(process.cwd(), "migrations");
  const migrations = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const migration of migrations) {
    db.exec(readFileSync(join(migrationsDir, migration), "utf8"));
  }

  return new SqliteD1Database(db);
}

export function asD1(db: SqliteD1Database): D1Database {
  return db as unknown as D1Database;
}

export function makeTestEnv(db: SqliteD1Database): Env {
  return {
    DB: asD1(db),
    ASSETS: { fetch: async () => new Response() } as unknown as Fetcher,
    HASH_SECRET: "test-secret",
    TURNSTILE_SECRET_KEY: "test-turnstile",
    HIDDEN_ADMIN_PATH: "/f4c9",
    ENVIRONMENT: "test",
  };
}

export function accessHeaders(
  email = "operator@example.com",
): Record<string, string> {
  return {
    "cf-access-authenticated-user-email": email,
    "cf-access-jwt-assertion": "test-access-jwt",
  };
}
