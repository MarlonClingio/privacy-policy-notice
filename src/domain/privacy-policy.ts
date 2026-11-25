/**
 * Cada alteração da política gera uma nova versão imutável. O aceite é sempre
 * vinculado a uma versão específica, o que permite exigir um novo aceite
 * quando a política muda e manter o histórico para fins de auditoria (LGPD).
 */
export interface PrivacyPolicyVersion {
  id: number;
  version: number;
  title: string;
  content: string;
  publishedAt: string;
}

export interface NewPrivacyPolicyVersion {
  title: string;
  content: string;
}

export interface PolicyAcceptance {
  id: number;
  userId: number;
  policyVersion: number;
  acceptedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface NewPolicyAcceptance {
  userId: number;
  policyVersion: number;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface PrivacyNoticeSettings {
  /** Liga/desliga globalmente a exibição do modal de notificação. */
  enabled: boolean;
}

export type ConsentStatus = 'accepted' | 'pending';

export interface UserConsentSummary {
  userId: number;
  name: string;
  email: string;
  createdAt: string;
  status: ConsentStatus;
  /** Última versão aceita pelo usuário (pode ser anterior à vigente). */
  lastAcceptedVersion: number | null;
  lastAcceptedAt: string | null;
}
