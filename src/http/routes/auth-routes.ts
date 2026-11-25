import { Router } from 'express';
import { z } from 'zod';
import type { User } from '../../domain/user.js';
import type { AuthService } from '../../services/auth-service.js';
import { SESSION_COOKIE, authenticate, currentUser } from '../middlewares/authenticate.js';
import { parse } from '../validation.js';

const loginSchema = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe a senha.'),
});

const homeFor = (user: User) => (user.role === 'admin' ? '/admin.html' : '/app.html');

export function authRoutes(auth: AuthService, options: { secureCookie: boolean; sessionTtlMs: number }): Router {
  const router = Router();

  router.post('/login', async (req, res) => {
    const { email, password } = parse(loginSchema, req.body);
    const { token, user } = await auth.login(email, password);

    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: options.secureCookie,
      maxAge: options.sessionTtlMs,
    });
    res.json({ user, redirectTo: homeFor(user) });
  });

  router.post('/logout', (req, res) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string') auth.logout(token);
    res.clearCookie(SESSION_COOKIE);
    res.status(204).end();
  });

  router.get('/me', authenticate(auth), (req, res) => {
    const user = currentUser(req);
    res.json({ user, home: homeFor(user) });
  });

  return router;
}
