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
import { get, run, now } from './db.ts';

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

  // Fotos enviadas: guardadas no banco (sobrevivem a reinícios do servidor), servidas com nosniff
  app.get('/uploads/:name', async (req, res, next) => {
    try {
      const name = String(req.params.name);
      if (!/^[\w-]+\.(jpg|png|webp)$/.test(name)) return res.status(404).end();
      const f = await get<{ mime: string; data: ArrayBuffer }>('SELECT mime, data FROM files WHERE name = ?', name);
      if (!f) return res.status(404).end();
      res.setHeader('Content-Type', f.mime);
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
      res.send(Buffer.from(f.data));
    } catch (e) { next(e); }
  });

  // Front-end compilado (produção)
  const dist = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api|\/uploads).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else if (config.isProd) {
    // Em produção sem a pasta dist: explica o problema em vez de um "Not Found" genérico
    console.error('[aviso] Pasta dist/ não encontrada. Configure o Build Command: npm ci --include=dev && npm run build');
    app.get(/^(?!\/api|\/uploads).*/, (_req, res) =>
      res.status(503).type('html').send(
        '<meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="font-family:sans-serif;padding:24px;background:#0f0d0b;color:#f4eee6">' +
          '<h2>Walisson Imóveis: front-end não compilado</h2><p>A API está no ar, mas o site não foi gerado.</p>' +
          '<p>No Render, em <b>Settings → Build Command</b>, use:</p><pre style="background:#231f1b;padding:12px;border-radius:8px;white-space:pre-wrap">npm ci --include=dev &amp;&amp; npm run build</pre>' +
          '<p>Depois toque em <b>Manual Deploy → Deploy latest commit</b>.</p></body>',
      ),
    );
  }

  // Limpeza periódica de sessões e tokens expirados
  const cleanup = () =>
    Promise.all([
      run('DELETE FROM sessions WHERE expires_at < ?', now()),
      run('DELETE FROM password_resets WHERE expires_at < ?', now() - 86400_000),
    ]).catch((e) => console.error('[limpeza]', e.message));
  cleanup();
  setInterval(cleanup, 60 * 60_000).unref();

  return app;
}
