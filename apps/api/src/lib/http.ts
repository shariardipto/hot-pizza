import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type z } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: { path: (string | number)[]; message: string }[],
  ) {
    super(message);
  }
}

export const badRequest = (message: string, code = 'bad_request', details?: HttpError['details']) =>
  new HttpError(400, code, message, details);
export const notFound = (what = 'Resource') => new HttpError(404, 'not_found', `${what} not found`);
export const conflict = (message: string, code = 'conflict') => new HttpError(409, code, message);
export const forbidden = (message = 'You do not have permission to do this') => new HttpError(403, 'forbidden', message);
export const unauthorized = () => new HttpError(401, 'unauthorized', 'Sign in required');

/** Wrap async route handlers (Express 5 forwards rejections, this keeps typings tidy). */
export function handler<P = any>(fn: (req: Request<P>, res: Response, next: NextFunction) => unknown): RequestHandler<P> {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function zodDetails(err: ZodError) {
  return err.issues.map((i) => ({ path: i.path.filter((p): p is string | number => typeof p !== 'symbol'), message: i.message }));
}

export function parse<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(422, 'validation_error', 'Some fields are invalid', zodDetails(r.error));
  return r.data;
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(422).json({ error: { code: 'validation_error', message: 'Some fields are invalid', details: zodDetails(err) } });
    return;
  }
  const anyErr = err as { type?: string; status?: number; code?: string; message?: string };
  if (anyErr?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'invalid_json', message: 'Malformed JSON body' } });
    return;
  }
  if (anyErr?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: { code: 'file_too_large', message: 'File is too large' } });
    return;
  }
  // Prisma known errors
  if (anyErr?.code === 'P2002') {
    res.status(409).json({ error: { code: 'conflict', message: 'A record with this value already exists' } });
    return;
  }
  if (anyErr?.code === 'P2025') {
    res.status(404).json({ error: { code: 'not_found', message: 'Record not found' } });
    return;
  }
  req.log?.error({ err }, 'Unhandled error');
  res.status(500).json({ error: { code: 'internal_error', message: 'Something went wrong' } });
}
