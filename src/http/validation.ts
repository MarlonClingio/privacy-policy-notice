import type { z } from 'zod';
import { ValidationError } from '../domain/errors.js';

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));
    throw new ValidationError('Dados inválidos.', details);
  }
  return result.data;
}
