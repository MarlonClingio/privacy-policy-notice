import type { DatabaseSync } from 'node:sqlite';
import type { AppConfig } from './config.js';
import { EventBus } from './events/event-bus.js';
import { openDatabase } from './repositories/sqlite/database.js';
import { SqlitePolicyAcceptanceRepository } from './repositories/sqlite/sqlite-policy-acceptance-repository.js';
import { SqlitePrivacyNoticeSettingsRepository } from './repositories/sqlite/sqlite-privacy-notice-settings-repository.js';
import { SqlitePrivacyPolicyRepository } from './repositories/sqlite/sqlite-privacy-policy-repository.js';
import { SqliteUserRepository } from './repositories/sqlite/sqlite-user-repository.js';
import { AuthService } from './services/auth-service.js';
import { PasswordHasher } from './services/password-hasher.js';
import { PrivacyNoticeService } from './services/privacy-notice-service.js';
import { PrivacyPolicyAdminService } from './services/privacy-policy-admin-service.js';
import { InMemorySessionStore } from './services/session-store.js';

export function buildContainer(config: Pick<AppConfig, 'databasePath' | 'sessionTtlMinutes'>) {
  const db: DatabaseSync = openDatabase(config.databasePath);
  const events = new EventBus();

  const repositories = {
    users: new SqliteUserRepository(db),
    policies: new SqlitePrivacyPolicyRepository(db),
    acceptances: new SqlitePolicyAcceptanceRepository(db),
    settings: new SqlitePrivacyNoticeSettingsRepository(db),
  };

  const hasher = new PasswordHasher();
  const sessions = new InMemorySessionStore(config.sessionTtlMinutes * 60_000);

  const services = {
    auth: new AuthService(repositories.users, hasher, sessions),
    privacyNotice: new PrivacyNoticeService(
      repositories.policies,
      repositories.acceptances,
      repositories.settings,
      events,
    ),
    privacyPolicyAdmin: new PrivacyPolicyAdminService(
      repositories.policies,
      repositories.acceptances,
      repositories.settings,
      events,
    ),
  };

  return { db, events, hasher, repositories, services };
}

export type Container = ReturnType<typeof buildContainer>;
