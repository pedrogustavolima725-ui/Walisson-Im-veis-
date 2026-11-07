import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.ts';
import { csrfProtection, loadSession } from './lib/auth.ts';
import { errorHandler } from './lib/http.ts';
import { authRouter } from './routes/auth.ts';
import { propertiesRouter } from './routes/properties.ts';
import { agentsRouter, clientRouter } from './routes/client.ts';
import { crmRouter } from './routes/crm.ts';
import { run, now } from './db.ts';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.set('sessionCookie', config.session.cookieName);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
          'img-src': ["'self'", 'data:', 'blob:', 'https://images.unsplash.com', 'https://*.tile.openstreetmap.org', 'https://tile.openstreetmap.org', 'https://*.basemaps.cartocdn.com'],
          'connect-src': ["'self'"],
          'frame-ancestors': ["'none'"],
          'form-action': ["'self'"],
          'object-src': ["'none'"],
          'upgrade-insecure-requests': config.isProd ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      strictTransportSecurity: config.isProd ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), payment=()');
    next();
  });

  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());

  const api = express.Router();
  api.use(rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Muitas requisições. Aguarde um instante.' } }));
  api.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  api.use(loadSession);
  api.use(csrfProtection);
  api.get('/health', (_req, res) => res.json({ ok: true }));
  api.use('/auth', authRouter);
  api.use('/properties', propertiesRouter);
  api.use('/agents', agentsRouter);
  api.use('/me', clientRouter);
  api.use('/crm', crmRouter);
  api.use((_req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
  api.use(errorHandler);
  app.use('/api', api);

  // Uploads: servidos como arquivos estáticos, sem execução e com nosniff
  app.use('/uploads', express.static(config.uploadDir, { maxAge: '30d', immutable: true, index: false, dotfiles: 'deny' }));

  // Front-end compilado (produção)
  const dist = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api|\/uploads).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // Limpeza periódica de sessões e tokens expirados
  const cleanup = () => {
    run('DELETE FROM sessions WHERE expires_at < ?', now());
    run('DELETE FROM password_resets WHERE expires_at < ?', now() - 86400_000);
  };
  cleanup();
  setInterval(cleanup, 60 * 60_000).unref();

  return app;
}
