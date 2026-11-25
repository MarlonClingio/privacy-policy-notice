import type { NewUser, User, UserWithCredentials } from '../domain/user.js';
import type {
  NewPolicyAcceptance,
  NewPrivacyPolicyVersion,
  PolicyAcceptance,
  PrivacyNoticeSettings,
  PrivacyPolicyVersion,
  UserConsentSummary,
} from '../domain/privacy-policy.js';

/*
 * Contratos de persistência. Os serviços dependem apenas destas interfaces,
 * então trocar SQLite por MySQL/PostgreSQL (ou um mock nos testes) não exige
 * alterações na regra de negócio.
 */

export interface UserRepository {
  create(user: NewUser): User;
  findById(id: number): User | null;
  findByEmailWithCredentials(email: string): UserWithCredentials | null;
  count(): number;
}

export interface PrivacyPolicyRepository {
  findCurrent(): PrivacyPolicyVersion | null;
  list(): PrivacyPolicyVersion[];
  publish(policy: NewPrivacyPolicyVersion): PrivacyPolicyVersion;
}

export interface CustomerConsentFilter {
  currentVersion: number | null;
  search?: string;
}

export interface PolicyAcceptanceRepository {
  find(userId: number, policyVersion: number): PolicyAcceptance | null;
  create(acceptance: NewPolicyAcceptance): PolicyAcceptance;
  listCustomerConsents(filter: CustomerConsentFilter): UserConsentSummary[];
}

export interface PrivacyNoticeSettingsRepository {
  get(): PrivacyNoticeSettings;
  save(settings: PrivacyNoticeSettings): PrivacyNoticeSettings;
}
