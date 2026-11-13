import express from 'express';
import helmet from 'helmet';
import type { Db } from './db/client';
import { errorHandler, HttpError } from './http';
import { dealerRoutes } from './routes/dealer';
import { publicRoutes } from './routes/public';
import { createTenantResolver, type TenantConfig } from './tenant';

export interface AppConfig extends TenantConfig { secureCookies: boolean; rateLimit: boolean }

export function createApp(db: Db, cfg: AppConfig) {
  const app = express();
  app.disable('x-powered-by');
  if (cfg.trustProxy) app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', async (_req, res) => res.json({ ok: true }));

  const tenants = createTenantResolver(db, cfg);
  // Mutations must be JSON: blocks form-encoded cross-site POSTs in addition to SameSite cookies.
  app.use('/api', (req, _res, next) => {
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) && req.headers['content-type'] && !req.is('application/json')) {
      return next(new HttpError(415, 'JSON хүсэлт шаардлагатай'));
    }
    next();
  });
  app.use('/api', tenants.middleware);
  app.use('/api/public', publicRoutes(db, { rateLimit: cfg.rateLimit }));
  app.use('/api/dealer', dealerRoutes(db, { secureCookies: cfg.secureCookies, rateLimit: cfg.rateLimit, onDomainsChanged: tenants.invalidate }));
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Олдсонгүй')));
  app.use(errorHandler);
  return app;
}
