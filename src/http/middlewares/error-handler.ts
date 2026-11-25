import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../domain/errors.js';

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...('details' in error && error.details ? { details: error.details } : {}),
      },
    });
    return;
  }

  // JSON malformado no corpo da requisição.
  if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Corpo da requisição não é um JSON válido.' } });
    return;
  }

  console.error(error);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erro inesperado. Tente novamente.' } });
}
