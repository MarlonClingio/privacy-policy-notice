import type { DatabaseSync } from 'node:sqlite';
import type { NewUser, User, UserRole, UserWithCredentials } from '../../domain/user.js';
import type { UserRepository } from '../contracts.js';

interface UserRow {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  password_hash: string;
  created_at: string;
}

const toUser = (row: UserRow): User => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  createdAt: row.created_at,
});

export class SqliteUserRepository implements UserRepository {
  constructor(private readonly db: DatabaseSync) {}

  create(user: NewUser): User {
    const result = this.db
      .prepare('INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(user.name, user.email, user.passwordHash, user.role, new Date().toISOString());

    return this.findById(Number(result.lastInsertRowid)) as User;
  }

  findById(id: number): User | null {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    return row ? toUser(row) : null;
  }

  findByEmailWithCredentials(email: string): UserWithCredentials | null {
    const row = this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
    return row ? { ...toUser(row), passwordHash: row.password_hash } : null;
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS total FROM users').get() as { total: number };
    return row.total;
  }
}
