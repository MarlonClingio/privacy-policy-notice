import { UnauthorizedError } from '../domain/errors.js';
import type { User } from '../domain/user.js';
import type { UserRepository } from '../repositories/contracts.js';
import type { PasswordHasher } from './password-hasher.js';
import type { SessionStore } from './session-store.js';

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionStore,
  ) {}

  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const found = this.users.findByEmailWithCredentials(email.trim());
    const valid = found ? await this.hasher.verify(password, found.passwordHash) : false;

    if (!found || !valid) {
      throw new UnauthorizedError('E-mail ou senha inválidos.');
    }

    const { passwordHash: _ignored, ...user } = found;
    return { token: this.sessions.create(user.id), user };
  }

  logout(token: string): void {
    this.sessions.destroy(token);
  }

  authenticate(token: string): User | null {
    const session = this.sessions.get(token);
    return session ? this.users.findById(session.userId) : null;
  }
}
