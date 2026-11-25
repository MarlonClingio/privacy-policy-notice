import type { DatabaseSync } from 'node:sqlite';
import type { NewPrivacyPolicyVersion, PrivacyPolicyVersion } from '../../domain/privacy-policy.js';
import type { PrivacyPolicyRepository } from '../contracts.js';
import { transaction } from './database.js';

interface PolicyRow {
  id: number;
  version: number;
  title: string;
  content: string;
  published_at: string;
}

const toPolicy = (row: PolicyRow): PrivacyPolicyVersion => ({
  id: row.id,
  version: row.version,
  title: row.title,
  content: row.content,
  publishedAt: row.published_at,
});

export class SqlitePrivacyPolicyRepository implements PrivacyPolicyRepository {
  constructor(private readonly db: DatabaseSync) {}

  findCurrent(): PrivacyPolicyVersion | null {
    const row = this.db.prepare('SELECT * FROM privacy_policy_versions ORDER BY version DESC LIMIT 1').get() as
      | PolicyRow
      | undefined;
    return row ? toPolicy(row) : null;
  }

  list(): PrivacyPolicyVersion[] {
    const rows = this.db.prepare('SELECT * FROM privacy_policy_versions ORDER BY version DESC').all() as unknown as
      PolicyRow[];
    return rows.map(toPolicy);
  }

  publish(policy: NewPrivacyPolicyVersion): PrivacyPolicyVersion {
    return transaction(this.db, () => {
      const { next } = this.db
        .prepare('SELECT COALESCE(MAX(version), 0) + 1 AS next FROM privacy_policy_versions')
        .get() as { next: number };

      this.db
        .prepare('INSERT INTO privacy_policy_versions (version, title, content, published_at) VALUES (?, ?, ?, ?)')
        .run(next, policy.title, policy.content, new Date().toISOString());

      return this.findCurrent() as PrivacyPolicyVersion;
    });
  }
}
