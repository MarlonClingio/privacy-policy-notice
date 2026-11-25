import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, NotFoundError } from '../src/domain/errors.js';
import type { User } from '../src/domain/user.js';
import { createTestContext, POLICY_V1 } from './helpers.js';

const context = { ipAddress: '127.0.0.1', userAgent: 'vitest' };

describe('PrivacyNoticeService', () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;
  let customer: User;
  let admin: User;

  beforeEach(async () => {
    ctx = await createTestContext();
    customer = ctx.createUser('Cliente');
    admin = ctx.createUser('Admin', 'admin');
  });

  const service = () => ctx.container.services.privacyNotice;
  const adminService = () => ctx.container.services.privacyPolicyAdmin;

  it('não exibe notificação quando não há política publicada', () => {
    expect(service().getNoticeFor(customer)).toEqual({ required: false });
  });

  it('exige aceite quando o cliente ainda não aceitou a versão vigente', () => {
    adminService().publishVersion(POLICY_V1, admin);

    const notice = service().getNoticeFor(customer);

    expect(notice.required).toBe(true);
    expect(notice.required && notice.policy.version).toBe(1);
  });

  it('não exibe novamente após o aceite ser persistido', () => {
    adminService().publishVersion(POLICY_V1, admin);

    service().accept(customer, 1, context);

    expect(service().getNoticeFor(customer)).toEqual({ required: false });
    expect(ctx.container.repositories.acceptances.find(customer.id, 1)).toMatchObject({
      userId: customer.id,
      policyVersion: 1,
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    });
  });

  it('volta a exigir aceite quando uma nova versão é publicada', () => {
    adminService().publishVersion(POLICY_V1, admin);
    service().accept(customer, 1, context);

    adminService().publishVersion({ title: 'v2', content: 'Novo texto da política de privacidade.' }, admin);

    const notice = service().getNoticeFor(customer);
    expect(notice.required && notice.policy.version).toBe(2);
  });

  it('não exibe a notificação quando ela está desativada pelo admin', () => {
    adminService().publishVersion(POLICY_V1, admin);
    adminService().updateSettings({ enabled: false }, admin);

    expect(service().getNoticeFor(customer)).toEqual({ required: false });
  });

  it('não exibe a notificação para administradores', () => {
    adminService().publishVersion(POLICY_V1, admin);

    expect(service().getNoticeFor(admin)).toEqual({ required: false });
  });

  it('recusa o aceite de uma versão que não é a vigente', () => {
    adminService().publishVersion(POLICY_V1, admin);
    adminService().publishVersion({ title: 'v2', content: 'Novo texto da política de privacidade.' }, admin);

    expect(() => service().accept(customer, 1, context)).toThrow(ConflictError);
  });

  it('recusa o aceite quando não existe política publicada', () => {
    expect(() => service().accept(customer, 1, context)).toThrow(NotFoundError);
  });

  it('é idempotente: aceitar duas vezes mantém o registro original e emite um único evento', () => {
    adminService().publishVersion(POLICY_V1, admin);
    const listener = vi.fn();
    ctx.container.events.on('privacy-policy.accepted', listener);

    const first = service().accept(customer, 1, context);
    const second = service().accept(customer, 1, context);

    expect(second).toEqual(first);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('PrivacyPolicyAdminService.listCustomerConsents', () => {
  it('lista apenas clientes com o status do aceite da versão vigente e a última versão aceita', async () => {
    const ctx = await createTestContext();
    const admin = ctx.createUser('Admin', 'admin');
    const ana = ctx.createUser('Ana');
    const bruno = ctx.createUser('Bruno');
    ctx.createUser('Carla');
    const { privacyNotice, privacyPolicyAdmin } = ctx.container.services;

    privacyPolicyAdmin.publishVersion(POLICY_V1, admin);
    privacyNotice.accept(ana, 1, context);
    privacyNotice.accept(bruno, 1, context);
    privacyPolicyAdmin.publishVersion({ title: 'v2', content: 'Novo texto da política de privacidade.' }, admin);
    privacyNotice.accept(ana, 2, context);

    const report = privacyPolicyAdmin.listCustomerConsents();

    expect(report.currentVersion).toBe(2);
    expect(report.totals).toEqual({ all: 3, accepted: 1, pending: 2 });
    expect(report.items.map(({ name, status, lastAcceptedVersion }) => ({ name, status, lastAcceptedVersion }))).toEqual([
      { name: 'Ana', status: 'accepted', lastAcceptedVersion: 2 },
      { name: 'Bruno', status: 'pending', lastAcceptedVersion: 1 },
      { name: 'Carla', status: 'pending', lastAcceptedVersion: null },
    ]);

    expect(privacyPolicyAdmin.listCustomerConsents({ status: 'pending' }).items).toHaveLength(2);
    expect(privacyPolicyAdmin.listCustomerConsents({ search: 'brun' }).items.map((i) => i.name)).toEqual(['Bruno']);
  });
});
