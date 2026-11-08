import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details);
export const unauthorized = (msg = 'Faça login para continuar.') => new HttpError(401, msg);
export const forbidden = (msg = 'Você não tem permissão para esta ação.') => new HttpError(403, msg);
export const notFound = (msg = 'Não encontrado.') => new HttpError(404, msg);

/** Valida e tipa o corpo/query com zod; retorna 400 com os campos inválidos. */
export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const fields: Record<string, string> = {};
    for (const issue of r.error.issues) {
      const key = issue.path.join('.') || '_';
      if (!fields[key]) fields[key] = issue.message;
    }
    throw badRequest('Verifique os campos destacados.', fields);
  }
  return r.data;
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, fields: err.details });
  }
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Conteúdo muito grande.' });
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Arquivo excede 8 MB.' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
  console.error(err);
  // Nunca vaza stack trace ou mensagens internas para o cliente
  res.status(500).json({ error: 'Erro interno. Tente novamente.' });
}

export const idParam = (v: unknown) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw badRequest('ID inválido.');
  return n;
};

/* zod helpers */
export const zStr = (max = 255) => z.string().trim().max(max);
export const zReqStr = (max = 255, msg = 'Campo obrigatório') => z.string().trim().min(1, msg).max(max);
export const zEmail = z.string().trim().toLowerCase().max(254).email('E-mail inválido');
export const zPhone = z
  .string()
  .trim()
  .max(20)
  .regex(/^[\d\s()+-]{8,20}$/, 'Telefone inválido');
export const zBool = z.union([z.boolean(), z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')]).transform((v) => v === true || v === 'true' || v === '1');

/* CPF / CNPJ: aceita com ou sem pontuação, valida os dígitos verificadores e guarda só os números */
export function validCpfCnpj(v: string) {
  const d = v.replace(/\D/g, '');
  if (/^(\d)\1+$/.test(d)) return false;
  const calc = (base: string, weights: number[]) => {
    const s = weights.reduce((acc, w, i) => acc + Number(base[i]) * w, 0) % 11;
    return s < 2 ? 0 : 11 - s;
  };
  if (d.length === 11) {
    const w1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
    const d1 = calc(d, w1);
    const d2 = calc(d, [11, ...w1]);
    return d1 === Number(d[9]) && d2 === Number(d[10]);
  }
  if (d.length === 14) {
    const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const d1 = calc(d, w1);
    const d2 = calc(d, [6, ...w1]);
    return d1 === Number(d[12]) && d2 === Number(d[13]);
  }
  return false;
}
export const zDocument = z
  .string()
  .trim()
  .max(20)
  .refine((v) => v === '' || validCpfCnpj(v), 'CPF ou CNPJ inválido')
  .transform((v) => v.replace(/\D/g, ''));
