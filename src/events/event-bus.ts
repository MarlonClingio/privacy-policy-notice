import type { PolicyAcceptance, PrivacyNoticeSettings, PrivacyPolicyVersion } from '../domain/privacy-policy.js';

/**
 * Catálogo de eventos de domínio. Novas integrações (e-mail, auditoria,
 * webhooks, CRM...) podem reagir a esses eventos sem alterar os serviços.
 */
export interface DomainEvents {
  'privacy-policy.published': { policy: PrivacyPolicyVersion; actorId: number };
  'privacy-policy.accepted': { acceptance: PolicyAcceptance };
  'privacy-notice.settings-changed': { settings: PrivacyNoticeSettings; actorId: number };
}

type Listener<K extends keyof DomainEvents> = (payload: DomainEvents[K]) => void;

export class EventBus {
  private readonly listeners: { [K in keyof DomainEvents]?: Listener<K>[] } = {};

  on<K extends keyof DomainEvents>(event: K, listener: Listener<K>): () => void {
    const list = (this.listeners[event] ??= []) as Listener<K>[];
    list.push(listener);
    return () => {
      list.splice(list.indexOf(listener), 1);
    };
  }

  emit<K extends keyof DomainEvents>(event: K, payload: DomainEvents[K]): void {
    for (const listener of this.listeners[event] ?? []) {
      // Uma falha em um listener não deve desfazer a operação principal.
      try {
        listener(payload);
      } catch (error) {
        console.error(`[event-bus] listener de "${event}" falhou`, error);
      }
    }
  }
}
