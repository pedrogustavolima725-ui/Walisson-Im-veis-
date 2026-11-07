import fs from 'node:fs';
import path from 'node:path';

// Carrega .env simples (sem dependência externa)
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const isProd = process.env.NODE_ENV === 'production';

export const config = {
  isProd,
  // Modo demonstração: exibe atalhos das contas de teste no login (só com SEED_DEMO / DEMO_MODE)
  demo: process.env.DEMO_MODE === 'true',
  port: Number(process.env.PORT ?? 3333),
  appUrl: process.env.APP_URL ?? process.env.RENDER_EXTERNAL_URL ?? (isProd ? 'http://localhost:3333' : 'http://localhost:5173'),
  databasePath: process.env.DATABASE_PATH ?? path.resolve(process.cwd(), 'data/walisson.db'),
  uploadDir: path.resolve(process.cwd(), 'data/uploads'),
  trustProxy: Number(process.env.TRUST_PROXY ?? 0),
  commissionRate: Number(process.env.COMMISSION_RATE ?? 6),
  session: {
    cookieName: isProd ? '__Host-wi_session' : 'wi_session',
    ttlMs: 1000 * 60 * 60 * 12, // 12h (sessão padrão)
    rememberTtlMs: 1000 * 60 * 60 * 24 * 30, // 30 dias ("lembrar de mim")
    mfaPendingTtlMs: 1000 * 60 * 5, // 5 min para concluir o 2FA
  },
  lockout: { maxAttempts: 5, minutes: 15 },
  passwordResetTtlMs: 1000 * 60 * 30,
};
