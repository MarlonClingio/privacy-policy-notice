import { Router } from 'express';
import { z } from 'zod';
import type { PrivacyNoticeService } from '../../services/privacy-notice-service.js';
import { currentUser } from '../middlewares/authenticate.js';
import { parse } from '../validation.js';

const acceptSchema = z.object({
  version: z.number().int().positive(),
});

/** Rotas consumidas pela área do cliente (o modal). Exigem usuário autenticado. */
export function privacyNoticeRoutes(service: PrivacyNoticeService): Router {
  const router = Router();

  router.get('/', (req, res) => {
    res.json(service.getNoticeFor(currentUser(req)));
  });

  router.post('/accept', (req, res) => {
    const { version } = parse(acceptSchema, req.body);
    const acceptance = service.accept(currentUser(req), version, {
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    });
    res.status(201).json({ acceptance });
  });

  return router;
}
