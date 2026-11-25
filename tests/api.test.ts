import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, POLICY_V1 } from './helpers.js';

describe('API HTTP', () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    ctx = await createTestContext();
    const admin = ctx.createUser('Admin', 'admin');
    ctx.createUser('Ana');
    ctx.createUser('Bruno');
    ctx.container.services.privacyPolicyAdmin.publishVersion(POLICY_V1, admin);
  });

  describe('autenticação', () => {
    it('rejeita credenciais inválidas', async () => {
      const response = await request(ctx.app)
        .post('/api/auth/login')
        .send({ email: 'ana@teste.com', password: 'errada' })
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('redireciona cliente e admin para as respectivas áreas', async () => {
      const customer = await request(ctx.app)
        .post('/api/auth/login')
        .send({ email: 'ana@teste.com', password: 'senha-de-teste' });
      const admin = await request(ctx.app)
        .post('/api/auth/login')
        .send({ email: 'admin@teste.com', password: 'senha-de-teste' });

      expect(customer.body.redirectTo).toBe('/app.html');
      expect(admin.body.redirectTo).toBe('/admin.html');
      expect(customer.headers['set-cookie']?.[0]).toMatch(/sid=.+HttpOnly/);
    });

    it('exige sessão para consultar a notificação', async () => {
      await request(ctx.app).get('/api/privacy-notice').expect(401);
    });

    it('invalida a sessão no logout', async () => {
      const agent = await ctx.login('ana@teste.com');
      await agent.post('/api/auth/logout').expect(204);
      await agent.get('/api/privacy-notice').expect(401);
    });
  });

  describe('fluxo de notificação do cliente', () => {
    it('exibe o modal após o login, registra o aceite e não exibe novamente em um novo login', async () => {
      const agent = await ctx.login('ana@teste.com');

      const pending = await agent.get('/api/privacy-notice').expect(200);
      expect(pending.body).toMatchObject({ required: true, policy: { version: 1, title: POLICY_V1.title } });

      const accepted = await agent.post('/api/privacy-notice/accept').send({ version: 1 }).expect(201);
      expect(accepted.body.acceptance).toMatchObject({ policyVersion: 1 });

      const newSession = await ctx.login('ana@teste.com');
      const after = await newSession.get('/api/privacy-notice').expect(200);
      expect(after.body).toEqual({ required: false });
    });

    it('retorna 409 ao aceitar uma versão desatualizada', async () => {
      const agent = await ctx.login('ana@teste.com');

      const response = await agent.post('/api/privacy-notice/accept').send({ version: 99 }).expect(409);
      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('valida o corpo da requisição de aceite', async () => {
      const agent = await ctx.login('ana@teste.com');

      const response = await agent.post('/api/privacy-notice/accept').send({ version: 'um' }).expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('painel administrativo', () => {
    it('bloqueia clientes nas rotas administrativas', async () => {
      const agent = await ctx.login('ana@teste.com');
      await agent.get('/api/admin/customers').expect(403);
    });

    it('mostra na grid quem aceitou e quem está pendente', async () => {
      const ana = await ctx.login('ana@teste.com');
      await ana.post('/api/privacy-notice/accept').send({ version: 1 }).expect(201);
      const admin = await ctx.login('admin@teste.com');

      const all = await admin.get('/api/admin/customers').expect(200);
      expect(all.body.totals).toEqual({ all: 2, accepted: 1, pending: 1 });
      expect(all.body.items.map((i: { name: string; status: string }) => [i.name, i.status])).toEqual([
        ['Ana', 'accepted'],
        ['Bruno', 'pending'],
      ]);

      const pending = await admin.get('/api/admin/customers?status=pending').expect(200);
      expect(pending.body.items.map((i: { name: string }) => i.name)).toEqual(['Bruno']);
    });

    it('ativa e desativa a exibição da notificação', async () => {
      const admin = await ctx.login('admin@teste.com');
      const customer = await ctx.login('bruno@teste.com');

      await admin.patch('/api/admin/privacy-policy/settings').send({ enabled: false }).expect(200);
      expect((await customer.get('/api/privacy-notice')).body).toEqual({ required: false });

      await admin.patch('/api/admin/privacy-policy/settings').send({ enabled: true }).expect(200);
      expect((await customer.get('/api/privacy-notice')).body.required).toBe(true);
    });

    it('publica nova versão e passa a exigir novo aceite de quem já havia aceitado', async () => {
      const ana = await ctx.login('ana@teste.com');
      await ana.post('/api/privacy-notice/accept').send({ version: 1 }).expect(201);
      const admin = await ctx.login('admin@teste.com');

      const published = await admin
        .post('/api/admin/privacy-policy/versions')
        .send({ title: 'Política v2', content: 'Novo texto com as mudanças da segunda versão.' })
        .expect(201);
      expect(published.body.policy.version).toBe(2);

      const notice = await ana.get('/api/privacy-notice').expect(200);
      expect(notice.body).toMatchObject({ required: true, policy: { version: 2 } });
    });

    it('valida os dados da nova versão', async () => {
      const admin = await ctx.login('admin@teste.com');

      const response = await admin
        .post('/api/admin/privacy-policy/versions')
        .send({ title: 'x', content: 'curto' })
        .expect(400);
      expect(response.body.error.details).toHaveLength(2);
    });
  });
});
