import type { NextFunction, Request, Response } from 'express';
import { ZodError, z } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}
export const notFound = (what = 'Олдсонгүй') => new HttpError(404, what);

const Uuid = z.string().uuid();
/** Route params that should be UUIDs: anything else is a 404, never a database error. */
export function uuidParam(req: Request, name = 'id'): string {
  const r = Uuid.safeParse(req.params[name]);
  if (!r.success) throw notFound();
  return r.data;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Мэдээлэл буруу байна', issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details });
  if (typeof err === 'object' && err && 'type' in err && (err as { type: string }).type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Буруу хүсэлт' });
  }
  const pgCode = (err as { code?: string; cause?: { code?: string } })?.code ?? (err as { cause?: { code?: string } })?.cause?.code;
  if (pgCode === '23505') return res.status(409).json({ error: 'Аль хэдийн бүртгэгдсэн' });
  console.error(err);
  return res.status(500).json({ error: 'Серверийн алдаа' });
}
