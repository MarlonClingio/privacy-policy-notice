import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import { fileURLToPath } from 'node:url';
import type { Container } from './container.js';
import { NotFoundError } from './domain/errors.js';
import { authenticate, requireRole } from './http/middlewares/authenticate.js';
import { errorHandler } from './http/middlewares/error-handler.js';
import { adminRoutes } from './http/routes/admin-routes.js';
import { authRoutes } from './http/routes/auth-routes.js';
import { privacyNoticeRoutes } from './http/routes/privacy-notice-routes.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));

export interface AppOptions {
  secureCookie?: boolean;
  sessionTtlMinutes?: number;
}

export function createApp({ services }: Container, options: AppOptions = {}): Express {
  const app = express();
  const requireAuth = authenticate(services.auth);

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use(
    '/api/auth',
    authRoutes(services.auth, {
      secureCookie: options.secureCookie ?? false,
      sessionTtlMs: (options.sessionTtlMinutes ?? 120) * 60_000,
    }),
  );
  app.use('/api/privacy-notice', requireAuth, privacyNoticeRoutes(services.privacyNotice));
  app.use('/api/admin', requireAuth, requireRole('admin'), adminRoutes(services.privacyPolicyAdmin));

  app.use('/api', () => {
    throw new NotFoundError('Recurso não encontrado.');
  });

  app.use(express.static(PUBLIC_DIR));
  app.use(errorHandler);

  return app;
}
