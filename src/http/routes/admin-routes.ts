import { Router } from 'express';
import { z } from 'zod';
import type { PrivacyPolicyAdminService } from '../../services/privacy-policy-admin-service.js';
import { currentUser } from '../middlewares/authenticate.js';
import { parse } from '../validation.js';

const settingsSchema = z.object({
  enabled: z.boolean(),
});

const publishSchema = z.object({
  title: z.string().trim().min(3, 'Título deve ter ao menos 3 caracteres.').max(150),
  content: z.string().trim().min(20, 'Texto deve ter ao menos 20 caracteres.').max(20_000),
});

const customersQuerySchema = z.object({
  status: z.enum(['accepted', 'pending']).optional(),
  search: z.string().trim().max(100).optional(),
});

/** Rotas do painel administrativo. Exigem usuário autenticado com papel `admin`. */
export function adminRoutes(service: PrivacyPolicyAdminService): Router {
  const router = Router();

  router.get('/privacy-policy', (_req, res) => {
    res.json(service.getOverview());
  });

  router.patch('/privacy-policy/settings', (req, res) => {
    const settings = parse(settingsSchema, req.body);
    res.json({ settings: service.updateSettings(settings, currentUser(req)) });
  });

  router.post('/privacy-policy/versions', (req, res) => {
    const input = parse(publishSchema, req.body);
    res.status(201).json({ policy: service.publishVersion(input, currentUser(req)) });
  });

  router.get('/customers', (req, res) => {
    const { status, search } = parse(customersQuerySchema, req.query);
    res.json(service.listCustomerConsents({ status, search: search || undefined }));
  });

  return router;
}
