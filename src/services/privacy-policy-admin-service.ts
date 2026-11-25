import type {
  ConsentStatus,
  NewPrivacyPolicyVersion,
  PrivacyNoticeSettings,
  PrivacyPolicyVersion,
  UserConsentSummary,
} from '../domain/privacy-policy.js';
import type { User } from '../domain/user.js';
import type { EventBus } from '../events/event-bus.js';
import type {
  PolicyAcceptanceRepository,
  PrivacyNoticeSettingsRepository,
  PrivacyPolicyRepository,
} from '../repositories/contracts.js';

export interface PrivacyPolicyOverview {
  settings: PrivacyNoticeSettings;
  currentPolicy: PrivacyPolicyVersion | null;
  versions: PrivacyPolicyVersion[];
}

export interface CustomerConsentReport {
  currentVersion: number | null;
  totals: Record<ConsentStatus | 'all', number>;
  items: UserConsentSummary[];
}

export class PrivacyPolicyAdminService {
  constructor(
    private readonly policies: PrivacyPolicyRepository,
    private readonly acceptances: PolicyAcceptanceRepository,
    private readonly settings: PrivacyNoticeSettingsRepository,
    private readonly events: EventBus,
  ) {}

  getOverview(): PrivacyPolicyOverview {
    const versions = this.policies.list();
    return { settings: this.settings.get(), currentPolicy: versions[0] ?? null, versions };
  }

  updateSettings(settings: PrivacyNoticeSettings, actor: User): PrivacyNoticeSettings {
    const saved = this.settings.save(settings);
    this.events.emit('privacy-notice.settings-changed', { settings: saved, actorId: actor.id });
    return saved;
  }

  publishVersion(input: NewPrivacyPolicyVersion, actor: User): PrivacyPolicyVersion {
    const policy = this.policies.publish(input);
    this.events.emit('privacy-policy.published', { policy, actorId: actor.id });
    return policy;
  }

  listCustomerConsents(filter: { status?: ConsentStatus; search?: string } = {}): CustomerConsentReport {
    const currentVersion = this.policies.findCurrent()?.version ?? null;
    const all = this.acceptances.listCustomerConsents({ currentVersion, search: filter.search });
    const accepted = all.filter((item) => item.status === 'accepted').length;

    return {
      currentVersion,
      totals: { all: all.length, accepted, pending: all.length - accepted },
      items: filter.status ? all.filter((item) => item.status === filter.status) : all,
    };
  }
}
