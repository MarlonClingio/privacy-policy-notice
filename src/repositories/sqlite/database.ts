import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Migrações versionadas e aplicadas em ordem. Para evoluir o schema basta
 * adicionar um novo item ao final do array (nunca editar um já aplicado).
 */
const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL CHECK (role IN ('customer', 'admin')),
    created_at    TEXT    NOT NULL
  );

  CREATE TABLE privacy_policy_versions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    version      INTEGER NOT NULL UNIQUE,
    title        TEXT    NOT NULL,
    content      TEXT    NOT NULL,
    published_at TEXT    NOT NULL
  );

  CREATE TABLE privacy_policy_acceptances (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    policy_version INTEGER NOT NULL REFERENCES privacy_policy_versions (version),
    accepted_at    TEXT    NOT NULL,
    ip_address     TEXT,
    user_agent     TEXT,
    UNIQUE (user_id, policy_version)
  );

  CREATE INDEX idx_acceptances_user ON privacy_policy_acceptances (user_id, policy_version DESC);

  CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
];

export function openDatabase(path: string): DatabaseSync {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }

  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  if (path !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  migrate(db);
  return db;
}

function migrate(db: DatabaseSync): void {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);');

  const row = db.prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations').get() as {
    version: number;
  };

  MIGRATIONS.slice(row.version).forEach((sql, index) => {
    const version = row.version + index + 1;
    transaction(db, () => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
        version,
        new Date().toISOString(),
      );
    });
  });
}

export function transaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
