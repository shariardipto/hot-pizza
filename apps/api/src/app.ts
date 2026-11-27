import compression from 'compression';
import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.ts';
import { prisma } from './db.ts';
import { env } from './env.ts';
import { errorHandler, notFound } from './lib/http.ts';
import { logger } from './lib/logger.ts';
import { enforceTwoFactor, loadSession, requireAuth } from './middleware/auth.ts';
import { serveUpload } from './modules/media/serve.ts';
import { commerceAdmin } from './routes/admin/commerce.ts';
import { contentAdmin } from './routes/admin/content.ts';
import { systemAdmin } from './routes/admin/system.ts';
import { publicRouter } from './routes/public.ts';
import { webhookRouter } from './routes/webhooks.ts';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY) app.set('trust proxy', 1);

  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url?.startsWith('/uploads/') || req.url === '/health' },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
    }),
  );
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());
  app.use(
    cors({
      origin: [env.WEB_URL, env.ADMIN_URL],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
      exposedHeaders: ['RateLimit', 'RateLimit-Policy'],
    }),
  );

  app.get('/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, db: 'up' });
    } catch {
      res.status(503).json({ ok: false, db: 'down' });
    }
  });

  // Media (local storage driver)
  app.use('/uploads', serveUpload);

  // Better Auth handles its own body parsing.
  app.all('/api/auth/*splat', toNodeHandler(auth));

  // Payment webhooks need raw bodies — mounted before express.json().
  app.use('/api/v1/payments', webhookRouter);

  // JSON + browser security reports (CSP `report-uri` / Reporting API content types).
  app.use(express.json({ limit: '2mb', type: ['application/json', 'application/csp-report', 'application/reports+json'] }));

  const v1 = Router();
  v1.use(publicRouter);

  const admin = Router();
  admin.use(loadSession, requireAuth, enforceTwoFactor);
  admin.use(systemAdmin, contentAdmin, commerceAdmin);
  v1.use('/admin', admin);

  app.use('/api/v1', v1);

  app.use((_req, _res, next) => next(notFound('Endpoint')));
  app.use(errorHandler);
  return app;
}
