import request from 'supertest';
import { createApp } from '../src/app.js';
import { buildContainer, type Container } from '../src/container.js';
import type { UserRole } from '../src/domain/user.js';

export const PASSWORD = 'senha-de-teste';

export const POLICY_V1 = {
  title: 'Política de Privacidade v1',
  content: 'Texto da primeira versão da política de privacidade.',
};

export async function createTestContext() {
  const container: Container = buildContainer({ databasePath: ':memory:', sessionTtlMinutes: 10 });
  const app = createApp(container);
  const passwordHash = await container.hasher.hash(PASSWORD);

  const createUser = (name: string, role: UserRole = 'customer') =>
    container.repositories.users.create({
      name,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@teste.com`,
      passwordHash,
      role,
    });

  /** Retorna um agente HTTP com o cookie de sessão já configurado. */
  const login = async (email: string) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
    return agent;
  };

  return { container, app, createUser, login };
}
