// Push (Firebase) e e-mail (Brevo) com os serviços externos simulados
import crypto from 'node:crypto';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.NODE_TEST = '1';
process.env.FIREBASE_SERVICE_ACCOUNT = Buffer.from(JSON.stringify({
  project_id: 'walisson-teste', client_email: 'push@walisson-teste.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), token_uri: 'https://oauth2.googleapis.com/token',
})).toString('base64');
process.env.BREVO_API_KEY = 'xkeysib-teste';
process.env.MAIL_FROM = 'contato@exemplo.com';

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

// Intercepta chamadas externas; requisições ao servidor local passam normalmente
const calls: { url: string; init: RequestInit }[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.startsWith('http://127.0.0.1')) return realFetch(input, init);
  calls.push({ url, init });
  if (url.includes('oauth2.googleapis.com')) {
    const assertion = new URLSearchParams(String(init.body)).get('assertion')!;
    const [h, p, s] = assertion.split('.');
    const ok = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), publicKey, Buffer.from(s, 'base64url'));
    const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
    if (!ok || claims.scope !== 'https://www.googleapis.com/auth/firebase.messaging') return new Response('{"error":"invalid_grant"}', { status: 400 });
    return Response.json({ access_token: 'ya29.teste', expires_in: 3600 });
  }
  if (url.includes('fcm.googleapis.com')) {
    const body = JSON.parse(String(init.body));
    if (body.message.token === 'token-velho-xxxxxxxxxxxxxxxxxxxx') return new Response('{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}', { status: 404 });
    return Response.json({ name: 'projects/walisson-teste/messages/1' });
  }
  if (url.includes('api.brevo.com')) return Response.json({ messageId: '<1@brevo>' });
  return new Response('não esperado', { status: 500 });
}) as typeof fetch;

const { ready, get } = await import('../src/db.ts');
const { createApp } = await import('../src/app.ts');
const { hashPassword } = await import('../src/lib/crypto.ts');
const { run, now } = await import('../src/db.ts');
let server: Server;
let base = '';
let cookie = '';
let csrf = '';
const req = async (path: string, body?: unknown, method?: string) => {
  const r = await realFetch(`${base}/api${path}`, {
    method: method ?? (body ? 'POST' : 'GET'),
    headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrf },
    body: body ? JSON.stringify(body) : undefined,
  });
  const c = r.headers.getSetCookie().map((x) => x.split(';')[0]).find((x) => x.startsWith('wi_session=') && x.length > 12);
  if (c) cookie = c;
  const j: any = await r.json();
  if (j.csrfToken) csrf = j.csrfToken;
  return { status: r.status, body: j };
};
const settle = () => new Promise((r) => setTimeout(r, 150));

before(async () => {
  await ready;
  const t = now();
  await run("INSERT INTO users (name, email, password_hash, role, created_at, updated_at) VALUES ('Corretora Teste','corretora@exemplo.com',?, 'corretor', ?, ?)", await hashPassword('SenhaForte2026'), t, t);
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  await req('/auth/login', { email: 'corretora@exemplo.com', password: 'SenhaForte2026' });
});
after(() => { server.close(); globalThis.fetch = realFetch; });

test('celular registrado recebe push e e-mail com o link certo', async () => {
  assert.equal((await req('/me/push-tokens', { token: 'token-do-celular-aaaaaaaaaaaaaaaaaa' })).status, 200);
  const s = await req('/me/notification-settings');
  assert.deepEqual([s.body.push, s.body.email, s.body.devices, s.body.pushAvailable, s.body.emailAvailable], [true, true, 1, true, true]);
  calls.length = 0;
  assert.equal((await req('/me/notifications/test', {})).status, 200);
  await settle();
  const fcm = calls.find((c) => c.url.includes('fcm.googleapis.com'))!;
  assert.ok(fcm, 'enviou push');
  assert.match(fcm.url, /projects\/walisson-teste\/messages:send/);
  assert.equal((fcm.init.headers as Record<string, string>).authorization, 'Bearer ya29.teste');
  const msg = JSON.parse(String(fcm.init.body)).message;
  assert.equal(msg.token, 'token-do-celular-aaaaaaaaaaaaaaaaaa');
  assert.equal(msg.data.title, 'Notificação de teste');
  assert.equal(msg.data.link, '/notificacoes');
  const mail = calls.find((c) => c.url.includes('api.brevo.com'))!;
  assert.ok(mail, 'enviou e-mail');
  const m = JSON.parse(String(mail.init.body));
  assert.equal(m.to[0].email, 'corretora@exemplo.com');
  assert.equal(m.subject, 'Notificação de teste');
  assert.match(m.htmlContent, /\/notificacoes/);
});

test('preferências desligadas não enviam; token inválido é removido', async () => {
  await req('/me/notification-settings', { email: false, push: false }, 'PUT');
  calls.length = 0;
  const { notify } = await import('../src/lib/events.ts');
  const uid = (await get<{ id: number }>("SELECT id FROM users WHERE email = 'corretora@exemplo.com'"))!.id;
  await notify(uid, { type: 'lead', title: 'Novo lead', link: '/crm/leads/1' });
  await settle();
  assert.equal(calls.length, 0, 'nada externo com tudo desligado');
  assert.ok(await get('SELECT 1 FROM notifications WHERE user_id = ? AND title = ?', uid, 'Novo lead'), 'continua no sino do app');

  await req('/me/notification-settings', { email: false, push: true }, 'PUT');
  await req('/me/push-tokens', { token: 'token-velho-xxxxxxxxxxxxxxxxxxxx' });
  await notify(uid, { type: 'lead', title: 'Outro lead' });
  await settle();
  assert.equal(calls.filter((c) => c.url.includes('fcm')).length, 2);
  assert.equal(calls.filter((c) => c.url.includes('brevo')).length, 0);
  assert.equal(await get('SELECT 1 FROM push_tokens WHERE token = ?', 'token-velho-xxxxxxxxxxxxxxxxxxxx'), undefined, 'token inválido apagado');
});

test('esqueci a senha envia e-mail com o link', async () => {
  calls.length = 0;
  await req('/auth/forgot', { email: 'corretora@exemplo.com' });
  await settle();
  const mail = calls.find((c) => c.url.includes('api.brevo.com'));
  assert.ok(mail);
  assert.match(JSON.parse(String(mail!.init.body)).htmlContent, /redefinir-senha\?token=/);
});
