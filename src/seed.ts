import type { Container } from './container.js';

const DEMO_PASSWORD = 'senha123';

const INITIAL_POLICY = {
  title: 'Atualização da Política de Privacidade',
  content: [
    'Atualizamos nossa Política de Privacidade para deixar mais claro como coletamos, utilizamos e protegemos seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).',
    'Principais mudanças: (1) detalhamos as finalidades do tratamento de dados de cadastro e de pedidos; (2) informamos os parceiros com quem os dados podem ser compartilhados para entrega e pagamento; (3) explicamos como exercer seus direitos de acesso, correção, portabilidade e exclusão.',
    'Ao clicar em "Li e aceito", você declara estar ciente e de acordo com os termos da versão vigente da política.',
  ].join('\n\n'),
};

export async function seedDemoData({ repositories, hasher }: Container): Promise<void> {
  if (repositories.users.count() > 0) return;

  const passwordHash = await hasher.hash(DEMO_PASSWORD);
  const users = [
    { name: 'Administrador', email: 'admin@exemplo.com', role: 'admin' as const },
    { name: 'Ana Souza', email: 'ana@exemplo.com', role: 'customer' as const },
    { name: 'Bruno Lima', email: 'bruno@exemplo.com', role: 'customer' as const },
    { name: 'Carla Mendes', email: 'carla@exemplo.com', role: 'customer' as const },
  ];
  const created = users.map((user) => repositories.users.create({ ...user, passwordHash }));

  const policy = repositories.policies.publish(INITIAL_POLICY);

  const carla = created.find((user) => user.email === 'carla@exemplo.com');
  if (carla) {
    repositories.acceptances.create({ userId: carla.id, policyVersion: policy.version, ipAddress: null, userAgent: 'seed' });
  }

  console.log(`[seed] dados de demonstração criados (senha de todos os usuários: ${DEMO_PASSWORD})`);
}
