import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import QRCode from 'qrcode';
import { z } from 'zod';
import { config } from '../config.ts';
import { all, get, run, now, tx } from '../db.ts';
import {
  hashPassword, verifyPassword, DUMMY_HASH, passwordProblems, randomToken, sha256,
  generateTotpSecret, verifyTotp, totpUri, generateRecoveryCodes,
} from '../lib/crypto.ts';
import { createSession, destroySession, requireAuth, USER_PUBLIC_COLS } from '../lib/auth.ts';
import { audit, notify } from '../lib/events.ts';
import { badRequest, parse, unauthorized, zEmail, zPhone, zReqStr, HttpError } from '../lib/http.ts';

export const authRouter = Router();

const limiterMsg = { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' };
// Nos testes automatizados os limites por IP são desligados (todas as requisições vêm de 127.0.0.1)
const skip = () => process.env.NODE_TEST === '1';
const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: limiterMsg, skip });
const signupLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: limiterMsg, skip });
const resetLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false, message: limiterMsg, skip });
const mfaLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 15, standardHeaders: 'draft-7', legacyHeaders: false, message: limiterMsg, skip });

const strongPassword = (ctx: () => { email?: string; name?: string }) =>
  z.string().max(128).superRefine((pw, c) => {
    const p = passwordProblems(pw, ctx());
    if (p.length) c.addIssue({ code: 'custom', message: `A senha precisa de: ${p.join(', ')}` });
  });

function me(userId: number) {
  return get(`SELECT ${USER_PUBLIC_COLS} FROM users u WHERE u.id = ?`, userId);
}

/* ---------------- Sessão atual ---------------- */
authRouter.get('/me', (req, res) => {
  res.json({
    user: req.user ?? null,
    csrfToken: req.session?.csrf_token ?? null,
    mfaPending: !!req.session?.mfa_pending,
  });
});

/* ---------------- Cadastro ---------------- */
authRouter.post('/register', signupLimiter, async (req, res) => {
  const base = parse(
    z.object({
      name: zReqStr(100, 'Informe seu nome').refine((v) => v.length >= 3, 'Nome muito curto'),
      email: zEmail,
      phone: zPhone.optional().or(z.literal('')),
      password: z.string(),
      acceptTerms: z.literal(true, { message: 'É necessário aceitar os termos e a política de privacidade' }),
      marketing: z.boolean().optional(),
    }),
    req.body,
  );
  parse(z.object({ password: strongPassword(() => base) }), { password: base.password });

  const exists = get('SELECT id FROM users WHERE email = ?', base.email);
  if (exists) throw badRequest('Verifique os campos destacados.', { email: 'Este e-mail já possui cadastro. Faça login ou recupere a senha.' });

  const hash = await hashPassword(base.password);
  const t = now();
  const { id } = run(
    `INSERT INTO users (name, email, phone, password_hash, role, marketing_opt_in, terms_accepted_at, created_at, updated_at)
     VALUES (?,?,?,?, 'cliente', ?, ?, ?, ?)`,
    base.name, base.email, base.phone || null, hash, base.marketing ? 1 : 0, t, t, t,
  );
  audit(req, 'auth.register', { email: base.email }, id);
  notify(id, { type: 'sistema', title: 'Bem-vindo(a) à Walisson Imóveis!', body: 'Ative a verificação em duas etapas no seu perfil para mais segurança.', link: '/perfil/seguranca' });
  const csrfToken = createSession(req, res, id);
  res.status(201).json({ user: me(id), csrfToken });
});

/* ---------------- Login ---------------- */
authRouter.post('/login', loginLimiter, async (req, res) => {
  const body = parse(z.object({ email: zEmail, password: z.string().min(1, 'Informe a senha').max(128), remember: z.boolean().optional() }), req.body);
  const user = get<{ id: number; password_hash: string; failed_logins: number; locked_until: number | null; active: number; totp_enabled: number }>(
    'SELECT id, password_hash, failed_logins, locked_until, active, totp_enabled FROM users WHERE email = ?',
    body.email,
  );
  const t = now();

  if (user?.locked_until && user.locked_until > t) {
    audit(req, 'auth.login_blocked', { email: body.email }, user.id);
    const mins = Math.ceil((user.locked_until - t) / 60_000);
    throw new HttpError(423, `Conta temporariamente bloqueada por excesso de tentativas. Tente em ${mins} min ou redefina sua senha.`);
  }

  // Sempre executa o scrypt para não revelar se o e-mail existe (timing attack)
  const ok = await verifyPassword(body.password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok || !user.active) {
    if (user) {
      const fails = user.failed_logins + 1;
      const lock = fails >= config.lockout.maxAttempts ? t + config.lockout.minutes * 60_000 : null;
      run('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?', lock ? 0 : fails, lock, user.id);
      if (lock) {
        notify(user.id, { type: 'seguranca', title: 'Conta bloqueada temporariamente', body: 'Detectamos várias tentativas de login com senha incorreta.', link: '/perfil/seguranca' });
        audit(req, 'auth.account_locked', { email: body.email }, user.id);
      }
    }
    audit(req, 'auth.login_failed', { email: body.email }, user?.id ?? null);
    throw unauthorized('E-mail ou senha incorretos.');
  }

  run('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?', user.id);
  // Rotação de sessão: descarta a sessão anterior deste navegador (evita session fixation)
  destroySession(req, res);

  if (user.totp_enabled) {
    const csrfToken = createSession(req, res, user.id, { mfaPending: true, remember: body.remember });
    audit(req, 'auth.mfa_challenge', {}, user.id);
    return res.json({ mfaRequired: true, csrfToken, remember: !!body.remember });
  }

  const csrfToken = createSession(req, res, user.id, { remember: body.remember });
  run('UPDATE users SET last_login_at = ? WHERE id = ?', t, user.id);
  audit(req, 'auth.login', {}, user.id);
  res.json({ user: me(user.id), csrfToken });
});

/* ---------------- 2FA: concluir login ---------------- */
authRouter.post('/mfa', mfaLimiter, (req, res) => {
  if (!req.session?.mfa_pending) throw unauthorized('Sessão de verificação expirada. Faça login novamente.');
  const body = parse(z.object({ code: z.string().trim().min(6).max(12), remember: z.boolean().optional() }), req.body);
  const sessionUser = get<{ user_id: number }>('SELECT user_id FROM sessions WHERE id = ?', req.session.id)!;
  const u = get<{ id: number; totp_secret: string; recovery_codes: string | null }>('SELECT id, totp_secret, recovery_codes FROM users WHERE id = ?', sessionUser.user_id)!;

  let ok = verifyTotp(u.totp_secret, body.code);
  let usedRecovery = false;
  if (!ok && u.recovery_codes) {
    const codes: string[] = JSON.parse(u.recovery_codes);
    const h = sha256(body.code.toUpperCase());
    if (codes.includes(h)) {
      ok = true;
      usedRecovery = true;
      run('UPDATE users SET recovery_codes = ? WHERE id = ?', JSON.stringify(codes.filter((c) => c !== h)), u.id);
    }
  }
  if (!ok) {
    audit(req, 'auth.mfa_failed', {}, u.id);
    throw badRequest('Código inválido ou expirado.', { code: 'Código inválido' });
  }
  destroySession(req, res);
  const csrfToken = createSession(req, res, u.id, { remember: body.remember });
  run('UPDATE users SET last_login_at = ? WHERE id = ?', now(), u.id);
  audit(req, usedRecovery ? 'auth.login_recovery_code' : 'auth.login', { mfa: true }, u.id);
  if (usedRecovery) notify(u.id, { type: 'seguranca', title: 'Código de recuperação utilizado', body: 'Gere novos códigos se estiverem acabando.', link: '/perfil/seguranca' });
  res.json({ user: me(u.id), csrfToken });
});

/* ---------------- Logout ---------------- */
authRouter.post('/logout', (req, res) => {
  if (req.user) audit(req, 'auth.logout');
  destroySession(req, res);
  res.json({ ok: true });
});

/* ---------------- Esqueci minha senha ---------------- */
authRouter.post('/forgot', resetLimiter, (req, res) => {
  const { email } = parse(z.object({ email: zEmail }), req.body);
  const user = get<{ id: number; name: string }>('SELECT id, name FROM users WHERE email = ? AND active = 1', email);
  let devResetUrl: string | undefined;
  if (user) {
    const token = randomToken(32);
    run('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL', now(), user.id);
    run('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?,?,?)', user.id, sha256(token), now() + config.passwordResetTtlMs);
    const url = `${config.appUrl}/redefinir-senha?token=${token}`;
    // Integração de e-mail: substitua este log pelo seu provedor (SES, SendGrid, Resend...)
    console.log(`[e-mail] Redefinição de senha para ${email}: ${url}`);
    if (!config.isProd) devResetUrl = url;
    audit(req, 'auth.password_reset_requested', {}, user.id);
  }
  // Mesma resposta exista ou não a conta (evita enumeração de usuários)
  res.json({ ok: true, message: 'Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.', devResetUrl });
});

authRouter.post('/reset', resetLimiter, async (req, res) => {
  const { token, password } = parse(z.object({ token: z.string().min(20).max(100), password: z.string().max(128) }), req.body);
  const row = get<{ id: number; user_id: number; expires_at: number; used_at: number | null; email: string }>(
    'SELECT pr.id, pr.user_id, pr.expires_at, pr.used_at, u.email FROM password_resets pr JOIN users u ON u.id = pr.user_id WHERE pr.token_hash = ?',
    sha256(token),
  );
  if (!row || row.used_at || row.expires_at < now()) throw badRequest('Link inválido ou expirado. Solicite um novo.');
  parse(z.object({ password: strongPassword(() => ({ email: row.email })) }), { password });
  const hash = await hashPassword(password);
  tx(() => {
    run('UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = NULL, updated_at = ? WHERE id = ?', hash, now(), row.user_id);
    run('UPDATE password_resets SET used_at = ? WHERE id = ?', now(), row.id);
    run('DELETE FROM sessions WHERE user_id = ?', row.user_id); // encerra todas as sessões
  });
  audit(req, 'auth.password_reset', {}, row.user_id);
  notify(row.user_id, { type: 'seguranca', title: 'Sua senha foi redefinida', body: 'Se não foi você, contate o suporte imediatamente.' });
  res.json({ ok: true });
});

/* ---------------- Alterar senha (logado) ---------------- */
authRouter.post('/password', requireAuth, async (req, res) => {
  const body = parse(z.object({ current: z.string().min(1, 'Informe a senha atual').max(128), password: z.string().max(128) }), req.body);
  const u = get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', req.user!.id)!;
  if (!(await verifyPassword(body.current, u.password_hash))) throw badRequest('Verifique os campos.', { current: 'Senha atual incorreta' });
  parse(z.object({ password: strongPassword(() => req.user!) }), { password: body.password });
  if (body.current === body.password) throw badRequest('Verifique os campos.', { password: 'A nova senha deve ser diferente da atual' });
  run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', await hashPassword(body.password), now(), req.user!.id);
  run('DELETE FROM sessions WHERE user_id = ? AND id != ?', req.user!.id, req.session!.id);
  audit(req, 'auth.password_changed');
  notify(req.user!.id, { type: 'seguranca', title: 'Senha alterada', body: 'As outras sessões foram encerradas por segurança.' });
  res.json({ ok: true });
});

/* ---------------- 2FA: configuração ---------------- */
authRouter.post('/2fa/setup', requireAuth, async (req, res) => {
  if (req.user!.totp_enabled) throw badRequest('A verificação em duas etapas já está ativa.');
  const secret = generateTotpSecret();
  run('UPDATE users SET totp_secret = ? WHERE id = ?', secret, req.user!.id);
  const uri = totpUri(secret, req.user!.email);
  const qr = await QRCode.toDataURL(uri, { margin: 1, width: 240, color: { dark: '#1a1612', light: '#f5efe6' } });
  res.json({ secret, uri, qr });
});

authRouter.post('/2fa/enable', requireAuth, (req, res) => {
  const { code } = parse(z.object({ code: z.string().trim().regex(/^\d{6}$/, 'Código de 6 dígitos') }), req.body);
  const u = get<{ totp_secret: string | null }>('SELECT totp_secret FROM users WHERE id = ?', req.user!.id)!;
  if (!u.totp_secret || !verifyTotp(u.totp_secret, code)) throw badRequest('Código inválido.', { code: 'Código inválido' });
  const codes = generateRecoveryCodes();
  run('UPDATE users SET totp_enabled = 1, recovery_codes = ? WHERE id = ?', JSON.stringify(codes.map((c) => sha256(c))), req.user!.id);
  audit(req, 'auth.2fa_enabled');
  notify(req.user!.id, { type: 'seguranca', title: 'Verificação em duas etapas ativada', body: 'Sua conta está mais protegida.' });
  res.json({ ok: true, recoveryCodes: codes });
});

authRouter.post('/2fa/disable', requireAuth, async (req, res) => {
  const { password } = parse(z.object({ password: z.string().min(1).max(128) }), req.body);
  const u = get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', req.user!.id)!;
  if (!(await verifyPassword(password, u.password_hash))) throw badRequest('Senha incorreta.', { password: 'Senha incorreta' });
  run('UPDATE users SET totp_enabled = 0, totp_secret = NULL, recovery_codes = NULL WHERE id = ?', req.user!.id);
  audit(req, 'auth.2fa_disabled');
  notify(req.user!.id, { type: 'seguranca', title: 'Verificação em duas etapas desativada' });
  res.json({ ok: true });
});

/* ---------------- Sessões ativas ---------------- */
authRouter.get('/sessions', requireAuth, (req, res) => {
  const rows = all<{ id: number; ip: string; user_agent: string; created_at: number; last_seen_at: number }>(
    'SELECT id, ip, user_agent, created_at, last_seen_at FROM sessions WHERE user_id = ? AND mfa_pending = 0 AND expires_at > ? ORDER BY last_seen_at DESC',
    req.user!.id, now(),
  );
  res.json(rows.map((r) => ({ ...r, current: r.id === req.session!.id })));
});

authRouter.delete('/sessions/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  run('DELETE FROM sessions WHERE id = ? AND user_id = ?', id, req.user!.id);
  audit(req, 'auth.session_revoked', { sessionId: id });
  res.json({ ok: true });
});

authRouter.post('/sessions/revoke-others', requireAuth, (req, res) => {
  const r = run('DELETE FROM sessions WHERE user_id = ? AND id != ?', req.user!.id, req.session!.id);
  audit(req, 'auth.sessions_revoked', { count: r.changes });
  res.json({ ok: true, count: r.changes });
});

/* Histórico de segurança do próprio usuário */
authRouter.get('/activity', requireAuth, (req, res) => {
  res.json(all("SELECT action, ip, user_agent, created_at FROM audit_logs WHERE user_id = ? AND action LIKE 'auth.%' ORDER BY id DESC LIMIT 30", req.user!.id));
});
