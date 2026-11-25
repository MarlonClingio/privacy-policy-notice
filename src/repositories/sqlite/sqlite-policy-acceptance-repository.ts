import type { DatabaseSync } from 'node:sqlite';
import type { NewPolicyAcceptance, PolicyAcceptance, UserConsentSummary } from '../../domain/privacy-policy.js';
import type { CustomerConsentFilter, PolicyAcceptanceRepository } from '../contracts.js';

interface AcceptanceRow {
  id: number;
  user_id: number;
  policy_version: number;
  accepted_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

interface ConsentRow {
  id: number;
  name: string;
  email: string;
  created_at: string;
  accepted_current: number;
  last_version: number | null;
  last_accepted_at: string | null;
}

const toAcceptance = (row: AcceptanceRow): PolicyAcceptance => ({
  id: row.id,
  userId: row.user_id,
  policyVersion: row.policy_version,
  acceptedAt: row.accepted_at,
  ipAddress: row.ip_address,
  userAgent: row.user_agent,
});

const escapeLike = (value: string): string => value.replace(/[\\%_]/g, (char) => `\\${char}`);

export class SqlitePolicyAcceptanceRepository implements PolicyAcceptanceRepository {
  constructor(private readonly db: DatabaseSync) {}

  find(userId: number, policyVersion: number): PolicyAcceptance | null {
    const row = this.db
      .prepare('SELECT * FROM privacy_policy_acceptances WHERE user_id = ? AND policy_version = ?')
      .get(userId, policyVersion) as AcceptanceRow | undefined;
    return row ? toAcceptance(row) : null;
  }

  /** Idempotente: um segundo aceite da mesma versão mantém o registro original. */
  create(acceptance: NewPolicyAcceptance): PolicyAcceptance {
    this.db
      .prepare(
        `INSERT INTO privacy_policy_acceptances (user_id, policy_version, accepted_at, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (user_id, policy_version) DO NOTHING`,
      )
      .run(
        acceptance.userId,
        acceptance.policyVersion,
        new Date().toISOString(),
        acceptance.ipAddress,
        acceptance.userAgent,
      );

    return this.find(acceptance.userId, acceptance.policyVersion) as PolicyAcceptance;
  }

  listCustomerConsents(filter: CustomerConsentFilter): UserConsentSummary[] {
    const rows = this.db
      .prepare(
        `SELECT u.id, u.name, u.email, u.created_at,
                (cur.id IS NOT NULL)  AS accepted_current,
                last.policy_version   AS last_version,
                last.accepted_at      AS last_accepted_at
           FROM users u
           LEFT JOIN privacy_policy_acceptances cur
                  ON cur.user_id = u.id AND cur.policy_version = :currentVersion
           LEFT JOIN privacy_policy_acceptances last
                  ON last.id = (SELECT a.id FROM privacy_policy_acceptances a
                                 WHERE a.user_id = u.id
                                 ORDER BY a.policy_version DESC LIMIT 1)
          WHERE u.role = 'customer'
            AND (:search IS NULL OR u.name LIKE :search ESCAPE '\\' OR u.email LIKE :search ESCAPE '\\')
          ORDER BY u.name COLLATE NOCASE`,
      )
      .all({
        currentVersion: filter.currentVersion,
        search: filter.search ? `%${escapeLike(filter.search)}%` : null,
      }) as unknown as ConsentRow[];

    return rows.map((row) => ({
      userId: row.id,
      name: row.name,
      email: row.email,
      createdAt: row.created_at,
      status: row.accepted_current ? 'accepted' : 'pending',
      lastAcceptedVersion: row.last_version,
      lastAcceptedAt: row.last_accepted_at,
    }));
  }
}
