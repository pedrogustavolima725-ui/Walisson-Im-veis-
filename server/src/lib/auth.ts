import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.ts';
import { get, run, now } from '../db.ts';
import { randomToken, sha256, safeEqual } from './crypto.ts';
import { forbidden, unauthorized } from './http.ts';

export type Role = 'cliente' | 'corretor' | 'admin';
export interface SessionUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  avatar: string | null;
  creci: string | null;
  bio: string | null;
  totp_enabled: number;
  marketing_opt_in: number;
  notify_email: number;
  notify_push: number;
  created_at: number;
}
export interface SessionInfo {
  id: number;
  csrf_token: string;
  mfa_pending: number;
  expires_at: number;
  created_at: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
      session?: SessionInfo;
    }
  }
}

export const USER_PUBLIC_COLS =
  'u.id, u.name, u.email, u.phone, u.role, u.avatar, u.creci, u.bio, u.totp_enabled, u.marketing_opt_in, u.notify_email, u.notify_push, u.created_at';

export function clientIp(req: Request) {
  return req.ip ?? req.socket.remoteAddress ?? '';
}

export async function createSession(req: Request, res: Response, userId: number, opts: { remember?: boolean; mfaPending?: boolean } = {}) {
  const token = randomToken(32);
  const csrf = randomToken(24);
  const ttl = opts.mfaPending ? config.session.mfaPendingTtlMs : opts.remember ? config.session.rememberTtlMs : config.session.ttlMs;
  const t = now();
  await run(
    `INSERT INTO sessions (token_hash, user_id, csrf_token, mfa_pending, ip, user_agent, created_at, last_seen_at, expires_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    sha256(token), userId, csrf, opts.mfaPending ? 1 : 0, clientIp(req), (req.get('user-agent') ?? '').slice(0, 300), t, t, t + ttl,
  );
  res.cookie(config.session.cookieName, token, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: opts.remember || opts.mfaPending ? ttl : undefined, // sem "lembrar": cookie de sessão do navegador
  });
  return csrf;
}

export async function destroySession(req: Request, res: Response) {
  if (req.session) await run('DELETE FROM sessions WHERE id = ?', req.session.id);
  res.clearCookie(config.session.cookieName, { path: '/', httpOnly: true, secure: config.isProd, sameSite: 'lax' });
}

/** Carrega o usuário a partir do cookie de sessão (se houver). */
export async function loadSession(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[config.session.cookieName];
  if (typeof token === 'string' && token.length > 20 && token.length < 100) {
    const row = await get<SessionUser & { s_id: number; csrf_token: string; mfa_pending: number; expires_at: number; s_created: number; last_seen_at: number; active: number }>(
      `SELECT ${USER_PUBLIC_COLS}, u.active, s.id AS s_id, s.csrf_token, s.mfa_pending, s.expires_at, s.created_at AS s_created, s.last_seen_at
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
      sha256(token),
    );
    const t = now();
    if (row && row.expires_at > t && row.active) {
      const { s_id, csrf_token, mfa_pending, expires_at, s_created, last_seen_at, active: _a, ...user } = row;
      req.session = { id: s_id, csrf_token, mfa_pending, expires_at, created_at: s_created };
      if (!mfa_pending) req.user = user;
      if (t - last_seen_at > 60_000) await run('UPDATE sessions SET last_seen_at = ? WHERE id = ?', t, s_id);
    } else if (row) {
      await run('DELETE FROM sessions WHERE id = ?', row.s_id);
    }
  }
  next();
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Proteção CSRF (synchronizer token): toda requisição que altera estado e
 * possui sessão precisa enviar o header X-CSRF-Token igual ao da sessão.
 * Somado ao cookie SameSite=Lax, impede requisições forjadas de outros sites.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method) || !req.session) return next();
  const header = req.get('x-csrf-token') ?? '';
  if (!safeEqual(header, req.session.csrf_token)) return next(forbidden('Token de segurança inválido. Recarregue a página.'));
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}

export const isStaff = (u?: SessionUser) => u?.role === 'corretor' || u?.role === 'admin';
