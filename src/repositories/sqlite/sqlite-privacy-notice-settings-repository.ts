import type { DatabaseSync } from 'node:sqlite';
import type { PrivacyNoticeSettings } from '../../domain/privacy-policy.js';
import type { PrivacyNoticeSettingsRepository } from '../contracts.js';

const ENABLED_KEY = 'privacy_notice.enabled';

export class SqlitePrivacyNoticeSettingsRepository implements PrivacyNoticeSettingsRepository {
  constructor(private readonly db: DatabaseSync) {}

  get(): PrivacyNoticeSettings {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(ENABLED_KEY) as
      | { value: string }
      | undefined;
    return { enabled: row ? row.value === '1' : true };
  }

  save(settings: PrivacyNoticeSettings): PrivacyNoticeSettings {
    this.db
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value')
      .run(ENABLED_KEY, settings.enabled ? '1' : '0');
    return this.get();
  }
}
