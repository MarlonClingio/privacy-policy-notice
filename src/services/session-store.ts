import { randomBytes } from 'node:crypto';

export interface Session {
  userId: number;
  expiresAt: number;
}

export interface SessionStore {
  create(userId: number): string;
  get(token: string): Session | null;
  destroy(token: string): void;
}

/**
 * Implementação em memória, suficiente para o escopo do teste. Em produção
 * pode ser substituída por Redis/banco sem alterar o restante da aplicação.
 */
export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, Session>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  create(userId: number): string {
    const token = randomBytes(32).toString('base64url');
    this.sessions.set(token, { userId, expiresAt: this.now() + this.ttlMs });
    return token;
  }

  get(token: string): Session | null {
    const session = this.sessions.get(token);
    if (!session) return null;

    if (session.expiresAt <= this.now()) {
      this.sessions.delete(token);
      return null;
    }
    return session;
  }

  destroy(token: string): void {
    this.sessions.delete(token);
  }
}
