import { ConflictError, NotFoundError } from '../domain/errors.js';
import type { PolicyAcceptance, PrivacyPolicyVersion } from '../domain/privacy-policy.js';
import type { User } from '../domain/user.js';
import type { EventBus } from '../events/event-bus.js';
import type {
  PolicyAcceptanceRepository,
  PrivacyNoticeSettingsRepository,
  PrivacyPolicyRepository,
} from '../repositories/contracts.js';

export type PrivacyNotice = { required: false } | { required: true; policy: PrivacyPolicyVersion };

export interface AcceptanceContext {
  ipAddress: string | null;
  userAgent: string | null;
}

/** Regras do lado do cliente: decidir se o modal aparece e registrar o aceite. */
export class PrivacyNoticeService {
  constructor(
    private readonly policies: PrivacyPolicyRepository,
    private readonly acceptances: PolicyAcceptanceRepository,
    private readonly settings: PrivacyNoticeSettingsRepository,
    private readonly events: EventBus,
  ) {}

  getNoticeFor(user: User): PrivacyNotice {
    if (user.role !== 'customer' || !this.settings.get().enabled) {
      return { required: false };
    }

    const policy = this.policies.findCurrent();
    if (!policy || this.acceptances.find(user.id, policy.version)) {
      return { required: false };
    }

    return { required: true, policy };
  }

  /**
   * O cliente informa a versão que leu. Se a política mudou enquanto o modal
   * estava aberto, o aceite é recusado para que ele leia o texto atualizado.
   */
  accept(user: User, version: number, context: AcceptanceContext): PolicyAcceptance {
    const current = this.policies.findCurrent();
    if (!current) {
      throw new NotFoundError('Nenhuma política de privacidade publicada.');
    }
    if (current.version !== version) {
      throw new ConflictError(`A versão vigente da política é a ${current.version}. Recarregue e leia o texto atualizado.`);
    }

    const existing = this.acceptances.find(user.id, version);
    if (existing) return existing;

    const acceptance = this.acceptances.create({ userId: user.id, policyVersion: version, ...context });
    this.events.emit('privacy-policy.accepted', { acceptance });
    return acceptance;
  }
}
