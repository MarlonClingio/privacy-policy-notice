import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../domain/errors.js';
import type { User, UserRole } from '../../domain/user.js';
import type { AuthService } from '../../services/auth-service.js';

export const SESSION_COOKIE = 'sid';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export function authenticate(auth: AuthService) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    const user = typeof token === 'string' ? auth.authenticate(token) : null;
    if (!user) {
      throw new UnauthorizedError('Sessão inválida ou expirada. Faça login novamente.');
    }
    req.user = user;
    next();
  };
}

export function requireRole(role: UserRole) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      throw new ForbiddenError('Você não tem permissão para acessar este recurso.');
    }
    next();
  };
}

/** Uso em handlers já protegidos por `authenticate`. */
export function currentUser(req: Request): User {
  if (!req.user) throw new UnauthorizedError('Usuário não autenticado.');
  return req.user;
}
