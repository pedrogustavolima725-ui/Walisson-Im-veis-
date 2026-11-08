import crypto from 'node:crypto';
import { config } from '../config.ts';
import { all, run } from '../db.ts';

/**
 * Notificações push via Firebase Cloud Messaging (API HTTP v1).
 * Autentica com a conta de serviço (FIREBASE_SERVICE_ACCOUNT) assinando um JWT RS256.
 */
type ServiceAccount = { project_id: string; client_email: string; private_key: string; token_uri?: string };

let account: ServiceAccount | null | undefined;
function getAccount(): ServiceAccount | null {
  if (account !== undefined) return account;
  const raw = config.firebaseServiceAccount;
  if (!raw) return (account = null);
  try {
    const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const a = JSON.parse(json);
    if (!a.project_id || !a.client_email || !a.private_key) throw new Error('campos ausentes');
    return (account = a);
  } catch (e) {
    console.error('[push] FIREBASE_SERVICE_ACCOUNT inválido:', (e as Error).message);
    return (account = null);
  }
}
export const pushEnabled = () => !!getAccount();

let cached: { token: string; exp: number } | null = null;
async function accessToken(a: ServiceAccount) {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: a.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: a.token_uri ?? 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })}`;
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(a.private_key).toString('base64url');
  const r = await fetch(a.token_uri ?? 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }),
  });
  const j = (await r.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!j.access_token) throw new Error(`OAuth do Firebase falhou: ${j.error ?? r.status}`);
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return cached.token;
}

/** Envia a notificação para todos os celulares do usuário. Remove tokens que deixaram de existir. */
export async function sendPush(userId: number, n: { title: string; body?: string; link?: string; type: string }) {
  const a = getAccount();
  if (!a) return 0;
  const tokens = await all<{ token: string }>('SELECT token FROM push_tokens WHERE user_id = ?', userId);
  if (!tokens.length) return 0;
  const auth = await accessToken(a);
  let sent = 0;
  for (const { token } of tokens) {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${a.project_id}/messages:send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${auth}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        message: {
          token,
          // Mensagem só de dados: o app monta a notificação (funciona aberto ou fechado)
          data: { title: n.title, body: n.body ?? '', link: n.link ?? '/', type: n.type },
          android: { priority: 'HIGH', ttl: '86400s' },
        },
      }),
    });
    if (r.ok) { sent++; continue; }
    const err = await r.text();
    if (r.status === 404 || /UNREGISTERED|registration-token-not-registered|INVALID_ARGUMENT/.test(err)) {
      await run('DELETE FROM push_tokens WHERE token = ?', token);
    } else {
      console.error(`[push] falha ${r.status}: ${err.slice(0, 300)}`);
    }
  }
  return sent;
}
