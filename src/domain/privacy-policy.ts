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
  enabled: boolean;
}

export type ConsentStatus = 'accepted' | 'pending';

export interface UserConsentSummary {
  userId: number;
  name: string;
  email: string;
  createdAt: string;
  status: ConsentStatus;
  lastAcceptedVersion: number | null;
  lastAcceptedAt: string | null;
}
