import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { buildContainer } from './container.js';
import { seedDemoData } from './seed.js';

try {
  process.loadEnvFile();
} catch {
}

const config = loadConfig();
const container = buildContainer(config);

if (config.seedDemoData) {
  await seedDemoData(container);
}

container.events.on('privacy-policy.accepted', ({ acceptance }) =>
  console.log(`[audit] usuário ${acceptance.userId} aceitou a política v${acceptance.policyVersion}`),
);
container.events.on('privacy-policy.published', ({ policy, actorId }) =>
  console.log(`[audit] admin ${actorId} publicou a política v${policy.version}`),
);
container.events.on('privacy-notice.settings-changed', ({ settings, actorId }) =>
  console.log(`[audit] admin ${actorId} ${settings.enabled ? 'ativou' : 'desativou'} a notificação`),
);

const app = createApp(container, {
  secureCookie: config.isProduction,
  sessionTtlMinutes: config.sessionTtlMinutes,
});

const server = app.listen(config.port, () => {
  console.log(`Servidor disponível em http://localhost:${config.port}`);
});

const shutdown = () => {
  server.close(() => {
    container.db.close();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
